import type { UserRole } from '@parqueavecino/contracts';

/** Rutas de la web en un solo lugar (nada de strings de URL sueltos en componentes). */
export const routes = {
  home: '/',
  howItWorks: '/#como-funciona',
  benefits: '/#beneficios',
  forPartners: '/#aliados',
  search: '/buscar',
  parkingLot: (id: string) => `/parqueaderos/${id}`,
  checkout: (bookingId: string) => `/checkout/${bookingId}`,
  login: '/ingresar',
  register: '/registro',
  myBookings: '/mis-mensualidades',
  profile: '/perfil',
  driver: {
    overview: '/mi-cuenta',
    history: '/mi-cuenta/historial',
    receipt: (bookingId: string) => `/mi-cuenta/recibo/${bookingId}`,
  },
  partner: {
    overview: '/aliados',
    lots: '/aliados/parqueaderos',
    payouts: '/aliados/pagos',
    documents: '/aliados/documentos',
  },
  admin: {
    overview: '/admin',
    users: '/admin/usuarios',
    lots: '/admin/parqueaderos',
    payments: '/admin/pagos',
    documents: '/admin/documentos',
    settings: '/admin/configuracion',
  },
} as const;

/** A dónde llega cada rol después de ingresar. */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return routes.admin.overview;
    case 'PARTNER':
      return routes.partner.overview;
    default:
      return routes.search;
  }
}

/** Panel de cada rol (enlace del avatar y botón del encabezado). */
export function panelForRole(role: UserRole): string {
  return role === 'DRIVER' ? routes.driver.overview : homeForRole(role);
}

/** `?next=` solo acepta rutas internas (evita redirecciones abiertas). */
export function safeNext(next: string | null): string | null {
  return next?.startsWith('/') && !next.startsWith('//') ? next : null;
}

/** Archivos estáticos de marca (apps/web/public). */
export const brandAssets = {
  logo: { src: '/brand/logo.png', width: 481, height: 234 },
} as const;
