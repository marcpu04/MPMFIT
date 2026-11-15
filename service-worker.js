const CACHE_NAME='mpmfit-mobile-shell-v1';
const APP_SHELL=[
 './MPMFIT%203.0.html',
 './nutrition.js',
 './cloud-sync.js',
 './manifest.json',
 './icons/icon.svg'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await Promise.all(APP_SHELL.map(async path=>{try{await cache.add(path)}catch(error){console.warn('MPMFIT: recurso no cacheado',path,error)}}));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('mpmfit-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   try{
    const response=await fetch(request);
    if(response.ok)cache.put('./MPMFIT%203.0.html',response.clone());
    return response;
   }catch(error){
    return (await cache.match(request))||(await cache.match('./MPMFIT%203.0.html'))||Response.error();
   }
  })());
  return;
 }
 if(APP_SHELL.some(path=>new URL(path,self.location).pathname===url.pathname)){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   const cached=await cache.match(request);
   const network=fetch(request).then(response=>{if(response.ok)cache.put(request,response.clone());return response}).catch(()=>null);
   return cached||(await network)||Response.error();
  })());
 }
});