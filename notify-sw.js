const NOTIFY_TAG = 'uit-planner-schedule';

/* Không có 2 dòng này, mỗi lần cập nhật file notify-sw.js, bản cũ vẫn tiếp
   tục chạy (SW mới bị kẹt ở trạng thái "waiting") cho tới khi đóng hết mọi
   tab đang mở — đây là lý do phổ biến khiến thông báo "im re" trên điện
   thoại sau khi sửa code. skipWaiting + clients.claim đảm bảo bản mới được
   dùng ngay từ lần tải lại trang kế tiếp. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  const d = event.data || {};
  if(d.type !== 'schedule-state') return;

  event.waitUntil((async () => {
    try{
      if(d.enabled && d.body){
        await self.registration.showNotification(d.title || 'Tiếp theo', {
          body: d.body,
          tag: NOTIFY_TAG,
          renotify: false,
          requireInteraction: true,
          silent: true,
          icon: 'icon-512.png',
          badge: 'icon-192.png',
          data: {gen: d.gen || 0}
        });
      }else{
        const list = await self.registration.getNotifications({tag: NOTIFY_TAG});
        list.forEach(n => {
          try{ n.close(); }catch(e){}
        });
      }

      if(event.ports && event.ports[0]) {
        event.ports[0].postMessage(true);
      }
    }catch(e){
      if(event.ports && event.ports[0]) {
        event.ports[0].postMessage(false);
      }
    }
  })());
});

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
      return self.clients.openWindow(
        self.registration.scope.replace(/__notify__\/?$/, '')
      );
    }
  })());
});