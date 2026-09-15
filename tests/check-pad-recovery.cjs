const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
(async()=>{
 sandbox.confirm=()=>true;run('ready=true;db=null');await run('audio()');run('trigger=()=>{}');
 run("p.samples.K={name:'kick',blob:new Blob(['wav']),start:0,end:1,gain:1};render()");assert.equal(els.padK.dataset.audio,'unavailable');assert.match(els.padK.querySelector('small').textContent,/retry/);
 rejectDecode=true;assert.equal(await run("audition('K')"),false);assert.match(els.status.textContent,/could not decode/);assert.ok(run('p.samples.K'));
 rejectDecode=false;assert.equal(await run("audition('K')"),true);assert.equal(els.padK.dataset.audio,'ready');
 run('delete buffers.K');const before=decodes;await run("Promise.all([decodeSample('K'),decodeSample('K')])");assert.equal(decodes,before+1);
 run("p.samples.S={name:'snare',blob:new Blob(['wav']),start:0,end:1,gain:1};p.pattern[0]=['K','S']");await run("decodeSample('S')");run("$('clearAll').onclick()");assert.equal(run('Object.keys(p.samples).length'),0);assert.equal(run('p.pattern[0].length'),0);assert.equal(els.undoAll.disabled,false);run("$('undoAll').onclick()");assert.equal(run('Object.keys(p.samples).length'),2);assert.equal(run('p.pattern[0].join()'),'K,S');assert.ok(run('buffers.K'));
 run("p.samples.H={name:'broken'};selected='H';render()");assert.equal(els.padH.dataset.audio,'unavailable');assert.match(els.size.textContent,/unavailable/);assert.equal(await run("audition('H')"),false);
 run("ready=false");await run("$('demo').onclick()");assert.match(els.status.textContent,/finish loading/);run('ready=true;recorder={key:"Q"}');await run("$('demo').onclick()");assert.match(els.status.textContent,/Finish recording/);run('recorder=null');
 els.thresholdDb.value=-48;els.thresholdDb.oninput();assert.equal(els.thresholdValue.textContent,'-48 dBFS');
 // A stale decode must not resurrect a deleted/replaced sample.
 let finish;sandbox.deferred=()=>new Promise(resolve=>finish=resolve);run("ctx.decodeAudioData=deferred;delete buffers.S");const waiting=run("decodeSample('S')");await new Promise(resolve=>setImmediate(resolve));run("eraseMany(['S'])");finish({duration:1});await waiting;assert.equal(run('buffers.S'),undefined);
 run('db=testDb');const loading=run('load(1)');await assert.rejects(run('load(2)'),/loading/);dbRequest.result=null;dbRequest.onsuccess();await loading;assert.equal(run('project'),1);
 console.log('PASS: unavailable pad labels, shared Listen recovery, decode deduplication, failed-data retention, clear-all/undo, malformed metadata, drum-load guards, threshold slider output, stale-decode deletion safety and concurrent-project guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
