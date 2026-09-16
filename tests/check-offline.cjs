const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const handlers={},stores=new Map();let online=true,failInstall=false,claimed=false;
const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {addAll:async requests=>{for(const r of requests){if(failInstall&&r.url.endsWith('sampler.js'))throw Error('download failed');store.set(r.url,new Response(r.url))}},match:async key=>store.get(typeof key==='string'?key:key.url),put:async(key,value)=>store.set(key,value)}},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)};
const sandbox={URL,Request,Response,caches,fetch:async()=>{if(!online)throw Error('offline');return new Response('network')},self:{registration:{scope:'https://example.com/sampler/'},clients:{claim:async()=>claimed=true},skipWaiting:async()=>{},addEventListener:(event,fn)=>handlers[event]=fn}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sw.js','utf8'),sandbox);
const waitEvent=async(type,props={})=>{let work;handlers[type]({...props,waitUntil:p=>work=p});await work};
(async()=>{
 await waitEvent('install');stores.set('another-app-cache',new Map());stores.set('letter-sampler:/sampler/:old',new Map());await waitEvent('activate');assert.ok(claimed);assert.ok(stores.has('another-app-cache'));assert.ok(!stores.has('letter-sampler:/sampler/:old'));
 online=false;for(const path of ['?touch=1','index.html?desktop=1','sampler.js','offline.js','manifest.webmanifest']){let response;handlers.fetch({request:{method:'GET',url:'https://example.com/sampler/'+path},respondWith:p=>response=p});assert.ok(response);assert.ok((await response).ok)}
 let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://example.com/other/'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 let status;await waitEvent('message',{data:{type:'CHECK_OFFLINE'},ports:[{postMessage:data=>status=data}]});assert.equal(status.ready,true);
 const active=[...stores.keys()].find(k=>k.startsWith('letter-sampler:'));stores.get(active).delete('https://example.com/sampler/mobile.js');await waitEvent('message',{data:{type:'CHECK_OFFLINE'},ports:[{postMessage:data=>status=data}]});assert.equal(status.ready,false);
 // Simulate installation of a new revision with a partial failed download.
 vm.runInContext(fs.readFileSync('sw.js','utf8').replace(/const REVISION = '[^']+';/,"const REVISION = 'failed-new-version';"),vm.createContext({...sandbox}));failInstall=true;await assert.rejects(waitEvent('install'),/download failed/);assert.ok(stores.has(active));assert.ok(!stores.has('letter-sampler:/sampler/:failed-new-version'));
 console.log('PASS: complete offline cache, GitHub subpath + layout-query routing, offline assets, scoped cleanup, cache verification and failed-update rollback.');
})().catch(error=>{console.error(error);process.exitCode=1});
