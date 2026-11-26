// 오프라인용 서비스 워커
// - 화면(HTML)과 manifest: 온라인이면 항상 최신을 받고, 오프라인이면 저장본을 씁니다.
// - 아이콘·글꼴: 저장본을 먼저 씁니다(파일 이름이 바뀌면 새로 받음).
const CACHE = 'todo-v9';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192-y.png', './icon-512-y.png', './icon-maskable-y.png', './apple-touch-icon-y.png', './fonts/GmarketSansMedium.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/');
  const key = req.mode === 'navigate' ? new Request('./index.html') : req;

  if (isPage) {
    // 네트워크 우선 (3초 넘으면 저장본)
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(req, { cache: 'no-cache' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
        if (res && res.ok) cache.put(key, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(key, { ignoreSearch: true })) || (await cache.match('./index.html')) || new Response('오프라인', { status: 503 });
      }
    })());
    return;
  }

  // 캐시 우선
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
