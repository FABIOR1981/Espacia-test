// ATENCIÓN: Al cambiar este número hazlo también en js/config.js para actualizar la interfaz.
const CACHE_NAME = 'espacia-cache-v4.9.17';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/manifest.json',
  
  // Archivos de Estilos (CSS)
  '/css/1_comunes.css',
  '/css/2_abmusu.css',
  '/css/2_agenda_v2.css',
  '/css/2_dashboard.css',
  '/css/2_informe.css',
  '/css/2_login.css',
  '/css/2_pdf_styles.css',
  '/css/2_reservas.css',

  // Archivos de Código (JS)
  '/js/persistencia/abm_usuario.js',
  '/js/agenda_v2.js',
  '/js/bloqueos.js',
  '/js/components/timeindicator.js',
  '/js/config.js',
  '/js/dashboard.js',
  '/js/informe_canceladas.js',
  '/js/informe_modular.js',
  '/js/login_local.js',
  '/js/modelo/reserva.js',
  '/js/pdf/pdf_core.js',
  '/js/pdf/pdf_reporte_general.js',
  '/js/pdf/pdf_reporte_nombre.js',
  '/js/pdf/pdf_ticket_cancela.js',
  '/js/pdf/pdf_ticket_reserva.js',
  '/js/reservas_futuras.js',
  '/js/utils.js',
  // Subcarpetas JS
  '/js/agenda/agenda_cancelar.js',
  '/js/agenda/agenda_detalle.js',
  '/js/agenda/agenda_reservar.js',

  // Imágenes y logos
  '/imagenes/icon-192.png',
  '/imagenes/icon-512.png',
  '/imagenes/logo_demaria.png'
];

// Instalar el Service Worker y almacenar en caché los archivos básicos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Descargando y guardando Espacia en caché local...');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. ESTRATEGIA "NETWORK FIRST"
  // Para HTML, JSON de datos y funciones de Netlify.
  if (
    event.request.mode === 'navigate' || 
    event.request.headers.get('accept').includes('text/html') ||
    url.pathname.includes('/.netlify/functions/') ||
    (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.json'))
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. ESTRATEGIA "STALE-WHILE-REVALIDATE" (EL FIX)
  // Para JS, CSS e Imágenes. Carga rápido desde caché pero busca actualizaciones en red.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// Activar y limpiar cachés viejas automáticamente
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});