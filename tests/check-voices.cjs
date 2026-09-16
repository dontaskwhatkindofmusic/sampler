const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
(async()=>{
 const nodes=[];sandbox.makeSource=()=>{const n={playbackRate:{value:1},stops:[],connect(to){return to},disconnect(){},start(at){this.started=at},stop(at){this.stops.push(at)}};nodes.push(n);return n};
 run("ready=true;ctx={currentTime:1,createBufferSource:makeSource,createGain:()=>({gain:{},connect(to){return to},disconnect(){}})};master={};p.samples.K={start:0,end:3,gain:1,voiceMode:'poly'};buffers.K={duration:3}");
 run("trigger('K');trigger('K')");assert.equal(nodes[0].stops.length,0);assert.equal(nodes[1].stops.length,0);
 run("p.samples.K.voiceMode='mono';ctx.currentTime=1.2;trigger('K')");assert.deepEqual(nodes[0].stops,[1.2]);assert.deepEqual(nodes[1].stops,[1.2]);
 run("trigger('K',2)");assert.deepEqual(nodes[2].stops,[2]);
 run("ctx.currentTime=1.5;trigger('K')");assert.deepEqual(nodes[2].stops,[2,1.5]);assert.deepEqual(nodes[4].stops,[2]);assert.equal(nodes[3].stops.length,0);
 run("playing=true;nextStep=7;nextTime=2;const metronome={stop(){throw Error('stop samples cut click')}};voices.add(metronome);stopSamples()");assert.equal(nodes[3].stops.length,0);assert.equal(nodes[4].stops.at(-1),1.5);assert.equal(run('playing'),true);assert.equal(run('nextStep'),7);assert.equal(run('nextTime'),2);
 run("setStepPage(3)");assert.equal(els.stepPage3['aria-pressed'],true);assert.equal(els.stepPage0['aria-pressed'],false);assert.equal(run("$('steps').children.filter(b=>!b.hidden).length"),8);
 run("selected='K';$('voiceMode').value='poly';$('voiceMode').onchange()");assert.equal(run('p.samples.K.voiceMode'),'poly');
 console.log('PASS: poly layering, mono restart, scheduled mono boundaries, stop-current-samples without cutting future notes/metronome/transport, four page button selection and saved sample mode.');
})().catch(e=>{console.error(e);process.exitCode=1});
