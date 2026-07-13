// Service Worker mínimo do Lumina — existe para tornar o app instalável (PWA)
// e cachear o "app shell" para carregamento instantâneo. Não faz cache de dados
// dinâmicos (Supabase); toda leitura/escrita de dados continua sempre pela rede.

const CACHE_NAME = 'lumina-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só intercepta GET; nunca intercepta chamadas de API/Supabase — essas sempre vão à rede.
  if (request.method !== 'GET' || request.url.includes('supabase.co')) return;

  // Navegação (troca de rota/refresh): network-first, cai pro shell em cache se offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos: cache-first com atualização em segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
