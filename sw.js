const VERSION='minhaj-v2';
const APP_CACHE=`${VERSION}:app`;
const APP=['./','./index.html','./subjects.html','./resources.html','./foundation.html','./suggest.html','./about.html','./admin.html','./css/style.css','./js/firebase.js','./js/app.js','./js/admin.js','./js/suggest.js','./manifest.json','./assets/logo.svg','./assets/background.svg','./assets/default-resource.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(APP_CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(APP_CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));});
