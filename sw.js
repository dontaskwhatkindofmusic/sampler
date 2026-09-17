'use strict';
// Regenerate REVISION with scripts/version-offline.py whenever app files change.
const REVISION = '7df6a642a12f5416';
const FILES=['index.html','mobile.html','desktop.css','mobile.css','layout.js','sampler.js','mobile.js','controls.js','tutorial.js','offline.js','manifest.webmanifest'];
const BASE=new URL(self.registration.scope);
const PREFIX='letter-sampler:'+BASE.pathname+':';
const CACHE=PREFIX+REVISION;
const URLS=FILES.map(file=>new URL(file,BASE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})))}catch(error){await caches.delete(CACHE);throw error}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==BASE.origin)return;
 let key=url.origin+url.pathname;if(key===BASE.href)key=new URL('index.html',BASE).href;
 if(!URLS.includes(key))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(key);if(cached)return cached;const response=await fetch(event.request);if(response.ok)await cache.put(key,response.clone());return response})());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='REPAIR_OFFLINE')event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));event.ports[0]?.postMessage({ready:true,revision:REVISION})}catch{event.ports[0]?.postMessage({ready:false})}})());
 if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const entries=await Promise.all(URLS.map(url=>cache.match(url)));event.ports[0]?.postMessage({ready:entries.every(Boolean),revision:REVISION})})());
});
