const NOTIFY_TAG = 'uit-planner-schedule';
const STATE_CACHE = 'uit-planner-notify-state-v3';
const STATE_URL = './__notify-state__';
let notifyBusy = false;
let notifyQueued = null;
let notifyLoop = null;

async function saveState(state){
  const c = await caches.open(STATE_CACHE);
  await c.put(STATE_URL, new Response(JSON.stringify(state), {headers:{'content-type':'application/json'}}));
}

async function closeTaggedNotifications(){
  const list = await self.registration.getNotifications({tag:NOTIFY_TAG});
  list.forEach(n => { try{ n.close(); }catch(e){} });
}

async function processNotifyQueue(){
  if(notifyBusy && notifyLoop) return notifyLoop;
  notifyBusy = true;
  notifyLoop = (async () => {
    try{
      while(notifyQueued){
        const d = notifyQueued;
        notifyQueued = null;
        await saveState({...d});
        if(d.enabled && d.body){
          await self.registration.showNotification(d.title || 'Tiếp theo', {
            body:d.body,
            tag:NOTIFY_TAG,
            renotify:false,
            requireInteraction:true,
            silent:true,
            data:{gen:d.gen || 0}
          });
        }else{
          await closeTaggedNotifications();
        }
      }
    } finally {
      notifyBusy = false;
      notifyLoop = null;
    }
  })();
  return notifyLoop;
}

self.addEventListener('message', event => {
  const d = event.data || {};
  if(d.type !== 'schedule-state') return;
  notifyQueued = d;
  event.waitUntil(processNotifyQueue().then(() => {
    if(event.ports && event.ports[0]) event.ports[0].postMessage(true);
  }));
});

self.addEventListener('notificationclick', event => {
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of list) {
      if('focus' in client) return client.focus();
    }
    if(self.clients.openWindow) return self.clients.openWindow(self.registration.scope.replace(/__notify__\/?$/, ''));
  })());
});
