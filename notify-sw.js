/* Không có 2 dòng dưới đây, mỗi lần cập nhật file notify-sw.js, bản cũ vẫn
   tiếp tục chạy (SW mới bị kẹt ở trạng thái "waiting") cho tới khi đóng hết
   mọi tab đang mở — đây là lý do phổ biến khiến thông báo "im re" trên điện
   thoại sau khi sửa code. skipWaiting + clients.claim đảm bảo bản mới được
   dùng ngay từ lần tải lại trang kế tiếp. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

/* Trang gọi registration.showNotification()/getNotifications() thẳng, nên
   service worker này không cần lắng nghe 'message' nữa — chỉ còn nhiệm vụ
   xử lý lúc người dùng bấm vào thông báo. */
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