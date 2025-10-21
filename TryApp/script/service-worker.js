const CACHE_NAME = 'redi-app-cache-v1';

const urlsToCache = [
  'HomeApp.html', // Añádelo explícitamente por si acaso
  'AppWeb.js', // Tu archivo JavaScript principal
  'Appweb.css', // CAMBIA 'styles.css' por el nombre real de tu archivo CSS
  'https://unpkg.com/lucide@latest' // La librería de íconos Lucide para que funcione offline
];

// Evento 'install': Se dispara cuando el Service Worker se instala.
// Aquí es donde guardamos los archivos en la caché.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Abriendo caché y guardando archivos de la app');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Falló el cacheo de archivos iniciales', err);
      })
  );
});

// Evento 'fetch': Se dispara cada vez que la app solicita un recurso (CSS, JS, imagen, etc.).
// Actúa como un proxy: primero busca en la caché, y si no lo encuentra, va a la red.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si la respuesta está en la caché, la retornamos.
        if (response) {
          return response;
        }
        // Si no, hacemos la petición a la red.
        return fetch(event.request);
      })
  );
});

// Evento 'activate': Se dispara cuando el Service Worker se activa.
// Se usa para limpiar cachés antiguas si actualizamos la versión.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
