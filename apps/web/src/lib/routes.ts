/** Rutas de la web en un solo lugar (nada de strings de URL sueltos en componentes). */
export const routes = {
  home: '/',
  howItWorks: '/#como-funciona',
  forPartners: '/#aliados',
  search: '/buscar',
  parkingLot: (id: string) => `/parqueaderos/${id}`,
  login: '/ingresar',
  register: '/registro',
  partnerPanel: '/aliados',
  myBookings: '/mis-mensualidades',
  profile: '/perfil',
} as const;

/** Archivos estáticos de marca (apps/web/public). */
export const brandAssets = {
  logo: { src: '/brand/logo.png', width: 481, height: 234 },
} as const;
