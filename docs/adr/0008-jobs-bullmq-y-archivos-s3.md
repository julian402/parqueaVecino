# 0008 — Jobs con BullMQ (Redis en la misma tarea) y archivos privados en S3

- Estado: aceptada
- Fecha: 2026-11-26
- Complementa: 0006

## Contexto

La Fase 4 trae tareas periódicas (barrido de reservas sin pagar, avisos de "tu mensualidad termina",
pólizas por vencer) y documentos de verificación que el aliado sube (póliza RC, RUT, facturación).
Hasta ahora el barrido era un `setInterval` dentro de la API, que con varias réplicas correría en
todas. ElastiCache cuesta unos USD 12/mes y no había bucket S3.

## Decisión

- **Puerto `JobScheduler`** (`apps/api/src/common/jobs`). Con `REDIS_URL` lo implementa **BullMQ**
  (un _job scheduler_ por tarea: cada ejecución la toma un solo worker aunque haya varias réplicas).
  Sin Redis (pruebas, desarrollo mínimo) usa temporizadores en el mismo proceso. Los jobs son
  idempotentes: cada aviso se marca como enviado (`expiry_notice_sent_at`).
- En AWS, **Redis corre como un contenedor más de la tarea Fargate** (imagen oficial desde ECR
  Public, sin persistencia, `noeviction`). No cuesta nada extra; si se reinicia, los programadores se
  vuelven a crear al arrancar la API. Con varias tareas se cambia `REDIS_URL` a ElastiCache.
- **Puerto `FileStorage`** (`apps/api/src/common/storage`) con adaptador S3 (S3Mock en local). Los
  archivos son privados: el navegador sube con una **URL prefirmada (PUT)** cuyo tipo y tamaño van
  dentro de la firma, la API verifica el archivo (HEAD) antes de registrarlo y se ven con URLs de
  descarga de pocos minutos. Bucket con CORS solo para el dominio de la app, cifrado y bloqueo de
  acceso público.
- **Correo** detrás del puerto `Mailer`: SMTP (Mailpit en local). Sin `SMTP_HOST` (hoy en AWS) solo
  se registra el asunto en el log; SES queda para la Fase 6.

## Consecuencias

- Una sola ejecución de cada job por intervalo, incluso al escalar la API.
- El historial de jobs se pierde si la tarea se reinicia (aceptable: se reprograman solos).
- Los archivos no pasan por la API (sin límite de cuerpo ni carga extra en Fargate).
- En AWS no salen correos hasta configurar SES; los avisos quedan marcados como enviados igual.
