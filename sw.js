/* Service worker: cài app ra màn hình chính, mở offline */
const CACHE = 'lich-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || r.mode !== 'navigate') return;   // chỉ cache trang chính; Firebase/font để nguyên
  e.respondWith(
    fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(ch => ch.put('./', c)); return res; })
      .catch(() => caches.match('./'))
  );
});
