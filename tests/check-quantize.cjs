const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
(async()=>{
 run("ready=true;db=null;p=fresh();p.bpm=120;ctx={currentTime:10};stepTimeline.push({step:0,time:10,duration:.5},{step:1,time:10.5,duration:.5});nextStep=2;nextTime=11");
 run("recordLiveHit('K',10.18)");assert.equal(run("p.pattern[0].join('')"),'K');assert.equal(run('p.freeNotes.length'),0);
 run("p.quantize=false;recordLiveHit('S',10.1);recordLiveHit('S',10.2)");assert.equal(run('p.freeNotes.length'),2);assert.ok(Math.abs(run('p.freeNotes[0].position')-.2)<1e-8);assert.ok(Math.abs(run('p.freeNotes[1].position')-.4)<1e-8);
 run("p.quantize=true;recordLiveHit('H',10.49)");assert.equal(run("p.pattern[1][0]"),'H');assert.equal(run('p.freeNotes.length'),2);
 const hits=[];sandbox.hit=(key,time)=>hits.push({key,time});run("trigger=hit;playing=true;nextStep=0;nextTime=20;ctx.currentTime=19.95;schedule()");assert.equal(hits[0].key,'K');assert.ok(Math.abs(hits[1].time-20.1)<1e-8);assert.ok(Math.abs(hits[2].time-20.2)<1e-8);
 hits.length=0;run('p.bpm=60;nextStep=0;nextTime=30;ctx.currentTime=29.95;schedule()');assert.ok(Math.abs(hits[1].time-30.2)<1e-8);assert.ok(Math.abs(hits[2].time-30.4)<1e-8);
 run("p.samples.S={name:'snare',blob:new Blob(['s']),start:0,end:1,gain:1};buffers.S={duration:1};eraseMany(['S'])");assert.equal(run('p.freeNotes.length'),0);run("$('undo').click()");assert.equal(run('p.freeNotes.length'),2);
 run("const restored=normalizeProject(JSON.parse(JSON.stringify({...p,samples:{}})))");assert.equal(run('restored.freeNotes.length'),2);assert.equal(run('restored.quantize'),true);
 run("p.quantize=false;stepTimeline.length=0;nextStep=0;nextTime=40;p.bpm=120;recordLiveHit('K',39.95)");assert.ok(Math.abs(run('p.freeNotes.at(-1).position')-7.9)<1e-8);
 run("$('clearPattern').onclick()");assert.equal(run('p.freeNotes.length'),0);assert.equal(run('p.pattern.flat().length'),0);
 console.log('PASS: quantized default, preserved off-grid hits/repeated notes, scheduling, tempo scaling, wraparound, delete/undo, project serialization and pattern clearing.');
})().catch(e=>{console.error(e);process.exitCode=1});
