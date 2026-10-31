/* Service worker gộp: vừa cài app ra màn hình chính / mở offline (sw.js cũ),
   vừa xử lý việc bấm vào thông báo lịch học (notify-sw.js cũ). Gộp làm một
   để chỉ cần đăng ký (register) một service worker duy nhất thay vì hai. */
const CACHE = 'lich';   // tên cố định, không cần đổi số phiên bản nữa: trang chính luôn lấy bản mới từ mạng (no-store) rồi ghi đè vào cache này; cache chỉ dùng khi mất mạng. Các cache cũ (lich-v3...) tự bị xóa lúc activate.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || r.mode !== 'navigate') return;   // chỉ cache trang chính; Firebase/font để nguyên
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match('./');
    const net = fetch(r, {cache:'no-store'}).then(async res => {
      // Đợi ghi xong để vòng đời respondWith/waitUntil bảo vệ cả lần cập nhật cache.
      if(res.ok && res.type === 'basic'){
        try{ await cache.put('./', res.clone()); }catch(_){}   // cache đầy: vẫn trả trang lấy từ mạng
      }
      return res;
    });
    if(!cached) return net;                      // lần đầu: chờ mạng
    e.waitUntil(net.catch(() => {}));           // mạng chậm vẫn kịp cập nhật cache cho lần mở sau
    return Promise.race([net, new Promise(ok => setTimeout(() => ok(cached), 3000))]).catch(() => cached);   // mất mạng hoặc quá 3 giây → mở bản đã lưu cho nhanh
  })());

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