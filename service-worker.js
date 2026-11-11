const CACHE='descanso-finance-v4-shell';
const SUPABASE_SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const CORE=[
  './','./index.html','./styles.css','./app.js','./config.js','./themes.js',
  './manifest.webmanifest','./assets/icon.svg',
  ...Array.from({length:50},(_,i)=>`./logos/${i+1}.png`)
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const path of CORE){try{const response=await fetch(path);if(response.ok)await cache.put(path,response)}catch{}}
  try{const sdk=await fetch(SUPABASE_SDK,{mode:'cors'});if(sdk.ok)await cache.put(SUPABASE_SDK,sdk)}catch{}
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('descanso-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin){
    if(url.href.startsWith(SUPABASE_SDK)){event.respondWith(caches.match(SUPABASE_SDK).then(cached=>cached||fetch(request)));}
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone()));return response}).catch(()=>caches.match('./index.html').then(response=>response||new Response('Open this website online once to make it available offline.',{status:503}))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response})));
});
