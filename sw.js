/* Service worker gộp: vừa cài app ra màn hình chính / mở offline (sw.js cũ),
   vừa xử lý việc bấm vào thông báo lịch học (notify-sw.js cũ). Gộp làm một
   để chỉ cần đăng ký (register) một service worker duy nhất thay vì hai. */
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

/* Trang gọi registration.showNotification()/getNotifications() thẳng, nên
   service worker này chỉ còn nhiệm vụ xử lý lúc người dùng bấm vào thông báo. */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({
      type:'window',
      includeUncontrolled:true
    });

    for(const client of list){
      if('focus' in client) return client.focus();
    }

    if(self.clients.openWindow) {
      return self.clients.openWindow(self.registration.scope);
    }
  })());
});
