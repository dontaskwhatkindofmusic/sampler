const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
Context.prototype.createBuffer=function(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,length,sampleRate:rate,numberOfChannels:channels,getChannelData:c=>data[c],copyToChannel:(x,c)=>data[c].set(x)}};
Context.prototype.close=async function(){this.state='closed'};
(async()=>{
 run('ready=true;db=null');await run('audio()');
 run("const fixture=ctx.createBuffer(1,2205,22050);fixture.getChannelData(0).set([-.9,-.25,0,.25,.9]);p.samples.K={blob:wav(fixture),name:'kick',start:0,end:.1,gain:.7,pitch:3};p.pattern[0]=['K'];trigger=()=>{}");
 rejectDecode=true;const beforeDecodes=decodes;await run("decodeSample('K')");assert.equal(decodes,beforeDecodes);assert.ok(Math.abs(run('buffers.K.getChannelData(0)[0]')+.9)<.0001);assert.equal(run('buffers.K.duration'),.1);
 const originalBuffer=run('buffers.K'),originalSample=run('p.samples.K'),beforeContexts=contexts;
 run("playing=true;recorder={key:'Q',state:'finishing',project:p};recordKey='Q';pending=true;parkAudio()");assert.equal(run('playing'),false);assert.equal(run('recorder'),null);assert.equal(run('pending'),false);assert.equal(run('rebuildOnGesture'),true);
 await run("audition('K')");assert.equal(contexts,beforeContexts+1);assert.equal(run('buffers.K'),originalBuffer);assert.equal(run('p.samples.K'),originalSample);assert.equal(run('p.pattern[0][0]'),'K');assert.equal(run('p.samples.K.gain'),.7);assert.equal(run('ctx.state'),'running');
 run('ctx.state="interrupted"');await run('audio()');assert.equal(contexts,beforeContexts+2);
 events.pageshow({persisted:true});await run('audio()');assert.equal(contexts,beforeContexts+3);
 // Reloading stored WAV works even when Safari's codec decoder always fails.
 run('delete buffers.K');await run("decodeSample('K')");assert.equal(decodes,beforeDecodes);assert.ok(run('buffers.K'));
 const bytes=await run('p.samples.K.blob.arrayBuffer()');sandbox.broken=bytes.slice(0,-2);assert.throws(()=>run('decodePCM16(broken,ctx)'),/incomplete/);
 // Legacy formats still use the browser decoder; do not misread them as PCM.
 rejectDecode=false;run("p.samples.S={blob:new Blob(['legacy audio']),name:'legacy'}");await run("decodeSample('S')");assert.equal(decodes,beforeDecodes+1);
 let timeout;sandbox.setTimeout=fn=>{timeout=fn;return 1};run("ctx.state='suspended';ctx.resume=()=>new Promise(()=>{})");const waiting=run('audio()');timeout();await assert.rejects(waiting,/did not wake/);assert.equal(run('rebuildOnGesture'),true);await run('audio()');assert.equal(run('ctx.state'),'running');assert.equal(micRequests,0);
 console.log('PASS: PCM WAV recovery with failed Safari decoder, sample fidelity, locked running-context replacement, interrupted-context replacement, cached-page return, retained buffers/settings/pattern, interrupted capture cleanup, truncated WAV rejection, legacy decoder fallback, bounded resume timeout and retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
