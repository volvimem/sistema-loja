const CACHE_NAME = 'filhao-cell-v2.8'; // Mudei para v2.9 para forçar atualização
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Instalação: Cache inicial
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação: Limpa caches antigos (v58, v57, etc)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim(); // Assume o controle da página imediatamente
});

// Interceptação de Rede (Network First)
// Tenta buscar na internet primeiro. Se der erro (offline), busca no cache.
self.addEventListener('fetch', (event) => {
  // Ignora requisições do Firebase/Firestore para não dar erro de CORS/Auth
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis')) {
    return; 
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

