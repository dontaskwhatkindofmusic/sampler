const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
(async()=>{
 assert.equal(micRequests,0);
 run('db=testDb');let loading=run('load(0)');dbRequest.result={bpm:110,length:10,division:1,pattern:Array.from({length:10},(_,i)=>i===9?['K']:[]),samples:{K:{blob:new Blob(['wav']),name:'kick',start:0,end:99,gain:1}}};dbRequest.onsuccess();await loading;
 assert.equal(contexts,1);assert.equal(resumes,0);assert.equal(decodes,1);assert.equal(run('ready'),true);assert.equal(run('p.pattern.length'),32);assert.equal(run('p.pattern[9][0]'),'K');assert.equal(run('p.samples.K.end'),1);assert.equal(run('p.bus.gain'),.65);
 await run('audio()');assert.equal(resumes,1);assert.equal(contexts,1);
 await run('audio()');assert.equal(resumes,1);
 run("setStepPage(3);p.length=32;held.add('Digit1');held.add('Digit8');db=null");await run("perform('K')");assert.equal(run('p.pattern[24][0]'),'K');assert.equal(run('p.pattern[31][0]'),'K');assert.equal(run('p.pattern[0].length'),0);assert.equal(run("$('steps').children.filter(b=>!b.hidden).length"),8);
 run("held.clear();chosen.clear();delete buffers.K;trigger=()=>{};");await run("perform('K')");assert.equal(decodes,2);
 run("p.bus={gain:1.1,compressor:false,threshold:-30,ratio:4};applyBus()");assert.equal(run('master.gain.value'),1.1);assert.equal(run('busDry.gain.value'),1);assert.equal(run('busWet.gain.value'),0);assert.equal(run('busCompressor.threshold.value'),-30);
 run("p.bus.compressor=true;applyBus()");assert.equal(run('busDry.gain.value'),0);assert.equal(run('busWet.gain.value'),1);
 run("$('padK').activePointer=17;padPointers.set(17,'K');");events.blur();assert.equal(run("$('padK').activePointer"),null);assert.equal(run('padPointers.size'),0);
 rejectDecode=true;run('db=testDb');loading=run('load(1)');dbRequest.result={bpm:110,length:8,division:1,pattern:Array.from({length:10},()=>[]),samples:{S:{blob:new Blob(['wav']),name:'snare',start:0,end:1,gain:1}}};dbRequest.onsuccess();await loading;assert.equal(run('ready'),true);assert.ok(run('p.samples.S'));assert.match(run("$('status').textContent"),/Could not load S/);
 rejectDecode=false;run('db=null');await run("perform('S')");assert.ok(run('buffers.S'));
 run('ctx.state="closed"');await run('audio()');assert.equal(contexts,2);assert.equal(run('ctx.state'),'running');
 run('db=testDb');loading=run('load(2)');dbRequest.error=Error('storage read failed');dbRequest.onerror();await assert.rejects(loading,/storage read failed/);assert.equal(run('ready'),true);assert.equal(run("$('project').disabled"),false);assert.ok(run('p.samples.S'));
 assert.equal(micRequests,0);
 console.log('PASS: refresh decoding without autoplay, old 10-step migration, trim recovery, gesture resume, steps 25/32 without key aliasing, missing-buffer retry, master wet/dry bypass, pointer reset, per-sample decode failure recovery, closed-context recovery, storage failure recovery, no page-load microphone request.');
})().catch(e=>{console.error(e);process.exitCode=1});
