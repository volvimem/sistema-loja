const CACHE_NAME = 'filhao-v34';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Instalação: Cacheia os arquivos iniciais
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação: Limpa caches antigos (v33, v32, etc) para forçar a atualização
self.addEventListener('activate', (e) => {
  e.waitUntil(
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
  self.clients.claim();
});

// Interceptação: Serve o cache se houver, senão busca na rede
self.addEventListener('fetch', (e) => {
  // Ignora requisições do Firebase (Firestore/Auth) para não quebrar o banco de dados
  if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) {
     return; 
  }

  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
