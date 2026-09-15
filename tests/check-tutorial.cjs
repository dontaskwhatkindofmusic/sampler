const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
(async()=>{
 let tick;const storage=new Map();sandbox.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 sandbox.document.body={classList:{add(){},remove(){}}};sandbox.document.querySelectorAll=()=>[];sandbox.document.querySelector=()=>null;sandbox.setInterval=f=>{tick=f;return 1};
 vm.runInContext(fs.readFileSync('tutorial.js','utf8'),sandbox);
 tick();assert.equal(els.tutorialWelcome?.open,undefined);run('ready=true');tick();assert.equal(els.tutorialWelcome.open,true);assert.equal(storage.size,1);
 els.tutorialSkip.onclick();tick();assert.equal(els.tutorialWelcome.open,false);
 run('startTutorial()');assert.equal(run('tutorialStep'),0);assert.equal(els.tutorialNext.disabled,true);assert.equal(micRequests,0);assert.equal(run('Object.keys(p.samples).length'),0);
 els.tutorialNext.onclick();assert.equal(run('tutorialStep'),0);
 run("p.samples[tutorialKey]={blob:new Blob(['sound']),name:'sound',start:0,end:1,gain:1}");tick();assert.equal(els.tutorialNext.disabled,false);els.tutorialNext.onclick();assert.equal(run('tutorialStep'),1);assert.equal(els.tutorialNext.disabled,true);
 els.metro.checked=true;els.overdub.checked=true;tick();els.tutorialNext.onclick();assert.equal(run('tutorialStep'),2);
 run('playing=true;p.pattern[0].push(tutorialKey)');tick();els.tutorialNext.onclick();assert.equal(run('tutorialStep'),3);
 els.overdub.checked=false;tick();els.tutorialNext.onclick();assert.equal(run('tutorialStep'),4);els.tutorialNext.onclick();els.tutorialNext.onclick();els.tutorialNext.onclick();assert.equal(run('tutorialStep'),-1);assert.equal(els.tutorialPanel.hidden,true);
 els.tutorialRestart.onclick();assert.equal(run('tutorialStep'),0);assert.equal(run('Object.keys(p.samples).length'),1);
 run("endTutorial();playing=true;held.add('KeyQ');recordHeld=true;finishRecording=()=>{recorder=null};recorder={key:'Q'}");await run('toggle()');assert.equal(run('playing'),false);assert.equal(run('recorder'),null);assert.equal(run('held.size'),0);assert.equal(run('recordHeld'),false);
 console.log('PASS: first-visit offer, persistent dismissal, Help restart, no automatic microphone access or sample replacement, action-gated loop tutorial, completion, and unified Stop.');
})().catch(e=>{console.error(e);process.exitCode=1});
