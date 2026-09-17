const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class El{set id(v){this._id=v;els[v]=this}get id(){return this._id}constructor(){this.children=[];this.dataset={};this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}}}append(e){this.children.push(e)}add(){}set innerHTML(v){}querySelector(){return this.child??=new El()}setAttribute(k,v){this[k]=v}setPointerCapture(){}focus(){}select(){}click(){return this.onclick?.({detail:0})}showModal(){this.open=true}close(){this.open=false}}
const els={},events={};let micRequests=0,contexts=0,resumes=0,decodes=0,rejectDecode=false,dbRequest;
const node=()=>({gain:{value:1},threshold:{value:-24},ratio:{value:12},connect(n){return n},disconnect(){}});
class Context{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}createGain(){return node()}createDynamicsCompressor(){return node()}async resume(){resumes++;this.state='running'}async decodeAudioData(){decodes++;if(rejectDecode)throw Error('decode failed');return {duration:1,sampleRate:44100,length:44100}}}
const sandbox={console,Blob,URL,Option:class{},Float32Array,Uint8Array,ArrayBuffer,DataView,AudioContext:Context,navigator:{audioSession:{type:'auto'},mediaDevices:{getUserMedia:async()=>{micRequests++;throw Error('should not request on load')}}},document:{documentElement:{dataset:{mobile:'false'}},getElementById:id=>els[id]??=new El(),createElement:()=>new El(),addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},indexedDB:{open:()=>({})},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('sampler.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('controls.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);sandbox.testDb={transaction:()=>({objectStore:()=>({get:()=>dbRequest={}})})};
Context.prototype.createBuffer=function(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,length,sampleRate:rate,numberOfChannels:channels,getChannelData:c=>data[c],copyToChannel:(x,c)=>data[c].set(x)}};
(async()=>{
 run('ready=true;db=null');await run('audio()');
 for(const rate of [22050,44100,48000,96000]){
  sandbox.testRate=rate;run('var constBuffer=ctx.createBuffer(1,testRate,testRate)');
  const input=run('constBuffer.getChannelData(0)');for(let i=0;i<input.length;i++)input[i]=.3*Math.sin(2*Math.PI*1000*i/rate);
  const bytes=await run('wav(constBuffer).arrayBuffer()');assert.equal(new DataView(bytes).getUint32(24,true),rate);assert.equal(bytes.byteLength,44+rate*2);sandbox.testBytes=bytes;
  const decoded=run('decodePCM16(testBytes,ctx)');assert.equal(decoded.sampleRate,rate);assert.equal(decoded.duration,1);const output=decoded.getChannelData(0);let maxError=0,energy=0,crossings=0;for(let i=0;i<output.length;i++){maxError=Math.max(maxError,Math.abs(input[i]-output[i]));energy+=output[i]*output[i];if(i&&output[i-1]<=0&&output[i]>0)crossings++}assert.ok(maxError<.00005);assert.ok(Math.abs(Math.sqrt(energy/output.length)-.3/Math.sqrt(2))<.00005);assert.ok(Math.abs(crossings-1000)<=1);
 }
 // Desktop Safari opts into a stable 48 kHz graph; iOS/other browsers don't.
 sandbox.navigator.userAgent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15';sandbox.navigator.maxTouchPoints=0;assert.equal(run('audioOptions().sampleRate'),48000);
 sandbox.navigator.maxTouchPoints=5;assert.equal(run('audioOptions().sampleRate'),undefined);sandbox.navigator.maxTouchPoints=0;sandbox.navigator.userAgent+=' Chrome/130';assert.equal(run('audioOptions().sampleRate'),undefined);
 sandbox.navigator.userAgent='iPhone Version/18.0 Safari/605.1.15';assert.equal(run('audioOptions().sampleRate'),undefined);
 sandbox.navigator.userAgent='Macintosh Version/18.0 Safari/605.1.15';let constraints;sandbox.navigator.mediaDevices.getUserMedia=async options=>{constraints=options;return {getAudioTracks:()=>[],getTracks:()=>[]}};await run('requestMicrophone()');assert.equal(constraints.audio.sampleRate.ideal,48000);assert.equal(constraints.audio.autoGainControl,false);assert.equal(constraints.audio.echoCancellation,false);assert.equal(constraints.audio.noiseSuppression,false);
 run("p.samples.K={pitch:-12,gain:.1,compression:20};");await run("install('K',wav(constBuffer),'test')");assert.equal(run('p.samples.K.pitch'),0);assert.equal(run('p.samples.K.gain'),1);assert.equal(run('p.samples.K.compression'),0);
 assert.equal(run('busDefaults().compressor'),false);assert.equal(run('normalizeProject({...fresh(),bus:{compressor:true}}).bus.compressor'),true);run("p.bus={...busDefaults(),compressor:true};$('busDry').onclick()");assert.equal(run('p.bus.compressor'),false);assert.equal(run('busDry.gain.value'),1);assert.equal(run('busWet.gain.value'),0);
 console.log('PASS: 22.05/44.1/48/96 kHz pitch, duration and RMS round-trips; Safari Mac-only clock; raw mic constraints; neutral replacement recordings; opt-in compression; preserved existing settings and explicit bypass.');
})().catch(e=>{console.error(e);process.exitCode=1});
