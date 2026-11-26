# 0005 — Autenticación propia con JWT (Cognito opcional)

- Estado: aceptada
- Fecha: 2026-11-26

## Contexto

Hay tres roles (conductor, aliado, admin). Se necesita que funcione igual en local y en AWS.

## Decisión

Módulo `auth` propio: contraseñas con argon2, access token corto y refresh token en cookie httpOnly,
guards por rol. Amazon Cognito queda como mejora futura.

## Consecuencias

- Sin dependencia de AWS para desarrollar ni para probar.
- El equipo es responsable de la seguridad del flujo (rate limiting, rotación del refresh token).
