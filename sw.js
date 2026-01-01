const CACHE_NAME = 'filhao-v26'; // ATUALIZADO PARA v26 (Força a atualização no celular)

const ASSETS = [
  './',
  './index.html',
  './manifest.json', // Adicionei o manifesto para garantir que ele carregue offline
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js'
  // OBS: Se você não tiver um arquivo 'icon.png' na pasta, remova ele desta lista para não dar erro
];

// Instalação: Baixa os arquivos essenciais
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Força o novo SW a entrar em ação imediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação: Limpa caches das versões antigas (v25, v24, etc.)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key); // Deleta o cache antigo para liberar espaço
        }
      }));
    }).then(() => self.clients.claim()) // Assume o controle da página na hora
  );
});

// Fetch: Estratégia "Network First" (Tenta internet, se cair usa o Cache)
self.addEventListener('fetch', (e) => {
  // Ignora requisições que não sejam GET ou que sejam do esquema chrome-extension
  if (e.request.method !== 'GET' || e.request.url.indexOf('http') !== 0) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Se a internet funcionou, atualiza o cache com a versão mais nova
        let clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
        return res;
      })
      .catch(() => {
        // Se a internet falhou, tenta entregar o que tem no cache
        return caches.match(e.request);
      })
  );
});
