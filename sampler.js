'use strict';
const mobileUI=document.documentElement?.dataset.mobile==='true';
const $=id=>document.getElementById(id), letters='QWERTYUIOPASDFGHJKLZXCVBNM';
const fresh=()=>({bpm:110,length:8,division:1,quantize:true,freeNotes:[],samples:{},pattern:Array.from({length:32},()=>[])});
let p=fresh(), project=0, db, ctx, master, selected='K', ready=false, playing=false, timer, nextTime=0, nextStep=0, origin=0, recordHeld=false, recorder=null, recordKey=null, pending=false, undo=null, importing=false;
const buffers={}, reversed={}, held=new Set(), chosen=new Set(), voices=new Set(), visuals=new Set();
const say=t=>$('status').textContent=t;
const fail=e=>say(e.message||String(e));
const guard=fn=>(...args)=>{try{return Promise.resolve(fn(...args)).catch(fail)}catch(e){fail(e)}};
const multiSelected=new Set(),padPointers=new Map(),keyCaptureStarted=new Map();
const gestureTime=e=>e.timeStamp??Date.now();
const HOLD_GESTURE_MS=350;
let stepPage=0,storageReadFailed=false,loadingProject=false;
const decoding=new WeakMap();
let deleteMode='off';const deleteSelection=new Set();
let microphone=null,microphoneRequest=null;
function setAudioSession(type){try{if(typeof navigator!=='undefined'&&navigator.audioSession)navigator.audioSession.type=type}catch{}}
function releaseMicrophone(){microphone?.getTracks().forEach(t=>t.stop());microphone=null;setAudioSession('playback');if($('micCheck'))$('micCheck').textContent='check microphone'}
async function requestMicrophone(){
 if(microphone?.getAudioTracks().some(t=>t.readyState==='live'))return microphone;
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone needs HTTPS and browser permission.');
 if(!microphoneRequest){setAudioSession('auto');microphoneRequest=navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}}).then(s=>{microphone=s;setAudioSession('play-and-record');return s}).finally(()=>microphoneRequest=null)}
 return microphoneRequest;
}
function cancelEmptyHold(){}function cancelEmptyHolds(){}
const emptyHint=k=>k+' is empty. Tap to record or import audio.';
function resetDelete(){deleteMode='off';deleteSelection.clear();renderDelete()}
function renderDelete(){const button=$('deleteMode');if(button){const count=deleteSelection.size;button.textContent=(deleteMode==='off'?'delete':count?'delete ('+count+')':'cancel delete')+(mobileUI?'':' [shift+x]');button.setAttribute('aria-pressed',deleteMode!=='off')}for(const k of letters)$('pad'+k).dataset.delete=deleteSelection.has(k)}
function deletePad(k){if(!p.samples[k]){say(k+' is empty.');return}deleteSelection.has(k)?deleteSelection.delete(k):deleteSelection.add(k);say(deleteSelection.size?deleteSelection.size+' selected · tap Delete to remove.':'No pads selected · cancel delete.');renderDelete()}
function resetPadPointers(){padPointers.clear();keyCaptureStarted.clear();for(const k of letters){const b=$('pad'+k);b.activePointer=null;b.capturePointer=null;b.recordGesture=false}}
async function activatePad(k){
 if(!ready){await audio();say('Loading saved samples · try again in a moment.');return}
 if(deleteMode!=='off'){if(recorder||importing){say('Finish recording or importing first.');return}deletePad(k);return}
 if(recorder?.key===k&&recorder.mode==='tap'){await audio();finishRecording();return}
 if(!p.samples[k]&&!recordHeld&&!held.has('Backquote')&&!held.has('Backspace')&&!held.has('Delete')){selected=k;render();await startRecording(k,'tap');return}
 await perform(k);
}
for(let n=1;n<=32;n++)$('length').add(new Option(n,n));
for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){const div=document.createElement('div');div.className='row';for(const k of row){const b=document.createElement('button');b.id='pad'+k;b.innerHTML=k+'<small>—</small>';b.onclick=guard(e=>{if(e?.detail>0&&b.suppressClick)return;return activatePad(k)});
b.onpointerdown=guard(async e=>{
 if(e.button!==0||b.activePointer!=null)return;
 e.preventDefault();b.pressTime=gestureTime(e);b.recordGesture=!p.samples[k]&&!recorder&&deleteMode==='off';b.activePointer=e.pointerId;b.suppressClick=true;b.capturePointer=recordHeld||held.has('Backquote')?e.pointerId:null;b.setPointerCapture(e.pointerId);
 if(!padPointers.size)multiSelected.clear();padPointers.set(e.pointerId,k);multiSelected.add(k);render();
 await activatePad(k);
});
const releasePad=e=>{if(b.activePointer!==e.pointerId)return;b.activePointer=null;padPointers.delete(e.pointerId);if(recordKey===k&&b.recordGesture&&gestureTime(e)-b.pressTime>=HOLD_GESTURE_MS)finishRecording();b.recordGesture=false;if(b.capturePointer===e.pointerId){b.capturePointer=null;if(recordKey===k&&recorder?.mode!=='tap')finishRecording()}};
b.onpointerup=releasePad;b.onpointercancel=e=>{releasePad(e);if(recordKey===k)finishRecording()};b.onlostpointercapture=releasePad;
b.ondragover=e=>{if(!Array.from(e.dataTransfer?.types||[]).includes('Files'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=ready&&!recorder&&!pending&&!importing?'copy':'none';b.classList.add('dragover')};
b.ondragleave=e=>{if(!b.contains(e.relatedTarget))b.classList.remove('dragover')};
b.ondrop=guard(async e=>{e.preventDefault();e.stopPropagation();b.classList.remove('dragover');const files=Array.from(e.dataTransfer?.files||[]);if(files.length!==1)throw Error('Drop one audio file onto a letter at a time.');await importAudio(files[0],k)});
div.append(b)}$('keyboard').append(div)}
for(let i=0;i<32;i++){const b=document.createElement('button');b.innerHTML=(i+1)+'<span>—</span>';b.onclick=()=>{chosen.has(i)?chosen.delete(i):chosen.add(i);renderSteps()};$('steps').append(b)}
const busDefaults=()=>({gain:.65,compressor:true,threshold:-24,ratio:12});
let busCompressor,busDry,busWet;
function validFreeNote(note){return note&&typeof note.key==='string'&&note.key.length===1&&letters.includes(note.key)&&Number.isFinite(note.position)&&note.position>=0&&note.position<32}
function normalizeProject(value){const x=value||fresh();x.quantize=x.quantize!==false;x.freeNotes=Array.isArray(x.freeNotes)?x.freeNotes.filter(validFreeNote).slice(0,4096):[];x.pattern=Array.from({length:32},(_,i)=>Array.isArray(x.pattern?.[i])?x.pattern[i]:[]);x.length=Math.max(1,Math.min(32,Number(x.length)||8));x.bus={...busDefaults(),...x.bus};for(const [key,min,max] of [['gain',0,1.5],['threshold',-100,0],['ratio',1,20]])if(!Number.isFinite(x.bus[key])||x.bus[key]<min||x.bus[key]>max)x.bus[key]=busDefaults()[key];x.bus.compressor=x.bus.compressor!==false;return x}
function applyBus(){if(!master)return;const b=p.bus||busDefaults();const set=(param,value)=>param.setTargetAtTime?param.setTargetAtTime(value,ctx.currentTime,.01):param.value=value;set(master.gain,b.gain);set(busCompressor.threshold,b.threshold);set(busCompressor.ratio,b.ratio);set(busDry.gain,b.compressor?0:1);set(busWet.gain,b.compressor?1:0)}
function ensureAudio(){if(ctx&&ctx.state!=='closed')return;ctx=new AudioContext({latencyHint:'interactive'});captureModule=null;master=ctx.createGain();busCompressor=ctx.createDynamicsCompressor();busDry=ctx.createGain();busWet=ctx.createGain();master.connect(busDry).connect(ctx.destination);master.connect(busCompressor).connect(busWet).connect(ctx.destination);applyBus()}
let rebuildOnGesture=false,audioUnlock=null;
function rebuildAudio(){const previous=ctx;stop();ctx=null;master=null;captureModule=null;rebuildOnGesture=false;audioUnlock=null;if(previous){try{previous.close()?.catch(()=>{})}catch{}}ensureAudio();if(recorder)$('play').textContent=mobileUI?'stop':'stop [space / esc]'}
function audio(){
 // Rebuild inside the tap/key gesture, not in a background visibility callback.
 // Buffers and saved samples survive; only the output graph is replaced.
 if(rebuildOnGesture||ctx?.state==='interrupted')rebuildAudio();else ensureAudio();
 if(ctx.state==='running')return Promise.resolve();if(audioUnlock)return audioUnlock;
 const engine=ctx;let timeout;
 const attempt=Promise.race([engine.resume(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Audio did not wake up. Tap a pad again to reconnect.')),2000)})]).then(()=>{if(ctx!==engine||engine.state!=='running')throw Error('Audio is interrupted. Tap a pad again to reconnect.')} ).catch(error=>{if(ctx===engine)rebuildOnGesture=true;throw error}).finally(()=>{clearTimeout(timeout);if(audioUnlock===attempt)audioUnlock=null});
 audioUnlock=attempt;return attempt;
}
// Our recordings/imports/drums are PCM16 WAV. Read their sample values directly:
// no codec service or live audio output is needed to recover browser storage.
function decodePCM16(bytes,engine){
 if(bytes.byteLength<12)return null;const view=new DataView(bytes);
 const tag=at=>String.fromCharCode(...new Uint8Array(bytes,at,4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE')return null;
 const end=view.getUint32(4,true)+8;if(end>bytes.byteLength||end<12)throw Error('Saved WAV is incomplete.');
 let format=null,data=null;
 for(let at=12;at+8<=end;){const size=view.getUint32(at+4,true),offset=at+8;if(offset+size>end)throw Error('Saved WAV is incomplete.');const kind=tag(at);
 if(kind==='fmt '&&size>=16)format={encoding:view.getUint16(offset,true),channels:view.getUint16(offset+2,true),rate:view.getUint32(offset+4,true),align:view.getUint16(offset+12,true),bits:view.getUint16(offset+14,true)};
 if(kind==='data')data={offset,size};at=offset+size+(size%2);
 }
 if(!format||!data)throw Error('Saved WAV has no audio data.');
 if(format.encoding!==1||format.bits!==16)return null;
 const {channels,rate,align}=format;if(channels<1||channels>2||align!==channels*2||rate<8000||rate>192000||!data.size||data.size%align)throw Error('Saved WAV format is invalid.');
 const frames=data.size/align;if(frames/rate>12.5)throw Error('Saved sample exceeds 12 seconds.');
 const buffer=engine.createBuffer(channels,frames,rate);
 for(let channel=0;channel<channels;channel++){const dest=buffer.getChannelData(channel);for(let frame=0;frame<frames;frame++)dest[frame]=view.getInt16(data.offset+frame*align+channel*2,true)/32768;}
 return buffer;
}
async function decodeStoredAudio(blob){const bytes=await blob.arrayBuffer();ensureAudio();return decodePCM16(bytes,ctx)||await ctx.decodeAudioData(bytes)}
async function decodeSample(k,target=p){
 const sample=target.samples[k];if(!sample)return;
 if(decoding.has(sample))return decoding.get(sample);
 const task=(async()=>{ensureAudio();if(!sample.blob?.arrayBuffer)throw Error('Stored audio is missing.');const buf=await decodeStoredAudio(sample.blob);if(p!==target||p.samples[k]!==sample)return;
 buffers[k]=buf;delete reversed[k];sample.start=Math.max(0,Math.min(Number(sample.start)||0,Math.max(0,buf.duration-.005)));sample.end=Math.max(sample.start+.001,Math.min(Number(sample.end)||buf.duration,buf.duration));sample.gain=Number.isFinite(sample.gain)?sample.gain:1;return buf})();
 decoding.set(sample,task);try{return await task}finally{decoding.delete(sample)}
}
async function audition(k){
 if(!ready){say('Loading saved samples · please wait.');return false}
 const target=p,sample=p.samples[k];if(!sample){say(emptyHint(k));return false}
 await audio();
 try{if(!buffers[k])await decodeSample(k,target)}catch{if(p===target&&p.samples[k]===sample){render();say(k+' has saved sample data, but its audio could not decode. Tap to retry or re-import audio.')}return false}
 if(p!==target||p.samples[k]!==sample)return false;
 render();if(!buffers[k])return false;trigger(k);return true;
}
function setStepPage(value){stepPage=Math.max(0,Math.min(3,Number(value)||0));$('stepPage').value=stepPage;renderSteps()}
for(let page=0;page<4;page++)$('stepPage'+page).onclick=()=>setStepPage(page);
function save(){if(storageReadFailed){$('saved').textContent='storage read failed · export before refreshing';return}if(!db){$('saved').textContent='not saved · storage unavailable';return}const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(p,project);$('saved').textContent='saving…';tx.oncomplete=()=>$('saved').textContent='saved in this browser';tx.onerror=()=>{$('saved').textContent='save failed · export a backup';fail(tx.error)}}
function renderSteps(){for(let page=0;page<4;page++)$('stepPage'+page).setAttribute('aria-pressed',page===stepPage);[...$('steps').children].forEach((b,i)=>{b.hidden=Math.floor(i/8)!==stepPage;b.disabled=i>=p.length;b.setAttribute('aria-pressed',chosen.has(i)||(Math.floor(i/8)===stepPage&&held.has('Digit'+(i%8+1))));const loose=[...new Set((p.freeNotes||[]).filter(n=>Math.floor(n.position)===i).map(n=>n.key))];b.querySelector('span').textContent=(p.pattern[i].join('')+loose.map(k=>k+'~').join('')).toLowerCase()||'—';b.title='Step '+(i+1)+': '+(p.pattern[i].join(', ')||'empty')+(loose.length?' · unquantized: '+loose.join(', '):'')});$('meter').textContent='· '+(p.length*p.division/4)+' bars of 4/4'}
function render(){for(const k of letters){const b=$('pad'+k),s=p.samples[k];b.dataset.loaded=!!s&&!!buffers[k];b.dataset.audio=s?(buffers[k]?'ready':ready?'unavailable':'loading'):'empty';b.setAttribute('aria-pressed',mobileUI?multiSelected.has(k):selected===k);b.querySelector('small').textContent=s?(s.name+(buffers[k]?'':ready?' · retry':' · loading')):'—';b.title=k+(s?' · '+s.name+(buffers[k]?'':' · audio unavailable; tap to retry'):' · empty')}$('bpm').value=p.bpm;$('length').value=p.length;$('division').value=p.division;$('quantize').checked=p.quantize!==false;renderSteps();editor();renderDelete();$('undoAll').disabled=!undo}
function editor(){const s=p.samples[selected];$('selected').textContent='selected: '+selected+(mobileUI?'':' [←/→]');$('sampleName').value=s?.name||'';$('gain').value=s?.gain??1;$('voiceMode').value=s?.voiceMode||'poly';$('reverse').checked=s?.reverse||false;$('start').value=s?.start||0;$('end').value=s?.end||0;$('size').textContent=s?((s.blob?.size||0)/1024).toFixed(1)+' KB · '+(buffers[selected]?buffers[selected].duration.toFixed(2)+' s':'audio unavailable'):'empty';for(const id of ['sampleName','gain','reverse','start','end','voiceMode','erase'])$(id).disabled=!s||(['start','end'].includes(id)&&!buffers[selected])}
function flash(k,when,length=.09){let lit=false,off=null;const b=$('pad'+k);const remove=()=>{if(lit){lit=false;b.playingCount=Math.max(0,(b.playingCount||0)-1);if(!b.playingCount)b.classList.remove('hit')}};const handle=setTimeout(()=>{visuals.delete(handle);lit=true;b.playingCount=(b.playingCount||0)+1;b.classList.add('hit');off=setTimeout(()=>{visuals.delete(off);remove()},Math.max(90,length*1000));visuals.add(off)},Math.max(0,(when-ctx.currentTime)*1000));visuals.add(handle);return ()=>{clearTimeout(handle);visuals.delete(handle);if(off){clearTimeout(off);visuals.delete(off)}remove()}}
function stopSamples(){if(!ctx)return;for(const source of voices)if(source.padKey&&source.startAt<=ctx.currentTime&&source.endAt>ctx.currentTime){source.endAt=ctx.currentTime;try{source.stop(ctx.currentTime)}catch{}source.cancelFlash?.()}say('Samples stopped · loop keeps running.')}
$('stopSamples').onclick=stopSamples;
function trigger(k,when=ctx.currentTime){const s=p.samples[k],buf=buffers[k];if(!s)return;if(!buf){say(k+' audio unavailable · tap its pad to retry loading.');return;}const source=ctx.createBufferSource(),gain=ctx.createGain();const start=Math.max(0,Math.min(s.start||0,Math.max(0,buf.duration-.005))),end=Math.max(start+.001,Math.min(s.end||buf.duration,buf.duration));let data=buf,offset=start;if(s.reverse){if(!reversed[k]){const b=ctx.createBuffer(1,buf.length,buf.sampleRate);b.copyToChannel(Float32Array.from(buf.getChannelData(0)).reverse(),0);reversed[k]=b}data=reversed[k];offset=buf.duration-end}source.buffer=data;const rate=2**((s.pitch||0)/12);source.playbackRate.value=rate;gain.gain.value=s.gain;const effects=[];let tail=source;if(s.compression){const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-24;compressor.ratio.value=s.compression;tail.connect(compressor);tail=compressor;effects.push(compressor)}if((s.cutoff??20000)<20000){const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=s.cutoff;tail.connect(filter);tail=filter;effects.push(filter)}if(s.pan){const pan=ctx.createStereoPanner();pan.pan.value=s.pan;tail.connect(pan);tail=pan;effects.push(pan)}tail.connect(gain).connect(master);source.padKey=k;source.startAt=when;source.endAt=when+Math.max(.001,end-start)/rate;if(s.voiceMode==='mono'){for(const previous of voices){if(previous.padKey!==k)continue;if(previous.startAt<=when&&previous.endAt>when){previous.endAt=when;try{previous.stop(when)}catch{}}else if(previous.startAt>when)source.endAt=Math.min(source.endAt,previous.startAt)}}voices.add(source);source.onended=()=>{source.cancelFlash?.();voices.delete(source);source.disconnect();for(const effect of effects)effect.disconnect();gain.disconnect()};const length=Math.max(.001,end-start);source.start(when,Math.max(0,offset),length);if(source.endAt<when+length/rate)source.stop(source.endAt);source.cancelFlash=flash(k,when,length/rate)}
function click(when,accent){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=accent?1400:950;g.gain.setValueAtTime(.12,when);g.gain.exponentialRampToValueAtTime(.001,when+.035);o.connect(g).connect(master);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect()};o.start(when);o.stop(when+.04)}
const stepTimeline=[];
const duration=()=>60/p.bpm*p.division;
function schedule(){while(playing&&nextTime<ctx.currentTime+.10){const step=nextStep,t=nextTime;stepTimeline.push({step,time:t,duration:duration()});if(stepTimeline.length>40)stepTimeline.shift();for(const k of p.pattern[step])trigger(k,t);for(const note of (p.freeNotes||[]).filter(n=>Math.floor(n.position)===step).sort((a,b)=>a.position-b.position))trigger(note.key,t+(note.position-step)*duration());if($('metro').checked)click(t,step===0);const handle=setTimeout(()=>{visuals.delete(handle);[...$('steps').children].forEach((b,i)=>b.classList.toggle('now',i===step))},Math.max(0,(t-ctx.currentTime)*1000));visuals.add(handle);nextTime+=duration();nextStep=(nextStep+1)%p.length}}
function stop(){playing=false;clearInterval(timer);for(const s of voices){try{s.stop()}catch{}}voices.clear();for(const h of visuals)clearTimeout(h);visuals.clear();for(const k of letters){$('pad'+k).playingCount=0;$('pad'+k).classList.remove('hit')}$('play').textContent=mobileUI?'play':'play [space]';for(const b of $('steps').children)b.classList.remove('now')}
async function toggle(){if(!ready){await audio();say('Loading saved samples · try again shortly.');return}if(playing||recorder){$('panic').click();return}await audio();playing=true;stepTimeline.length=0;origin=nextTime=ctx.currentTime+.03;nextStep=0;$('play').textContent=mobileUI?'stop':'stop [space / esc]';schedule();timer=setInterval(schedule,25)}
function recordLiveHit(key,now=ctx.currentTime){
 const candidates=[...stepTimeline,{step:nextStep,time:nextTime}];
 if(p.quantize!==false){const step=candidates.reduce((a,b)=>Math.abs(a.time-now)<Math.abs(b.time-now)?a:b).step%p.length;if(!p.pattern[step].includes(key))p.pattern[step].push(key)}
 else{p.freeNotes??=[];if(p.freeNotes.length>=4096){say('Live note limit reached · clear some steps before recording more.');return}const previous=[...stepTimeline].reverse().find(n=>n.time<=now);const raw=previous?previous.step+(now-previous.time)/(previous.duration||duration()):(now-nextTime)/duration()+nextStep;const position=((raw%p.length)+p.length)%p.length;p.freeNotes.push({key,position})}
 save();renderSteps();
}
$('quantize').onchange=()=>{p.quantize=$('quantize').checked;save();say(p.quantize?'Quantize on · new live hits snap to the step grid.':'Quantize off · new live hits keep your timing.')};
async function perform(k){if(!ready)return;selected=k;render();if(held.has('Backspace')||held.has('Delete')){if(deleteMode==='off')deleteMode='bulk';deletePad(k);return}if(recordHeld||held.has('Backquote')){await startRecording(k);return}const steps=new Set(chosen);for(let i=0;i<p.length;i++)if(Math.floor(i/8)===stepPage&&held.has('Digit'+(i%8+1)))steps.add(i);if(steps.size){if(!p.samples[k]){say(emptyHint(k));return}for(const i of steps){if(i>=p.length)continue;const row=p.pattern[i],at=row.indexOf(k),loose=(p.freeNotes||[]).some(n=>n.key===k&&Math.floor(n.position)===i);if(at>=0)row.splice(at,1);else if(!loose)row.push(k);p.freeNotes=(p.freeNotes||[]).filter(n=>!(n.key===k&&Math.floor(n.position)===i))}save();renderSteps();say('Updated '+steps.size+' steps · release steps to play pads freely.');return}if(!await audition(k))return;if(playing&&$('overdub').checked)recordLiveHit(k)}
async function install(k,blob,name){cancelEmptyHold(k);const target=p;const buffer=await decodeStoredAudio(blob);if(p!==target)throw Error('Project changed before audio was ready. Import it again.');if(buffer.duration<.01)throw Error('Recording was too short. Try again.');buffers[k]=buffer;delete reversed[k];p.samples[k]={blob,name,start:0,end:buffer.duration,gain:1,reverse:false};save();render();say(k+' ready · '+buffer.duration.toFixed(2)+' seconds.')}
// Capture on the audio thread: threshold detection and a 20 ms pre-roll do
// not depend on page timers, so short attacks survive a threshold trigger.
const captureProcessor = `
class HoldCapture extends AudioWorkletProcessor {
 constructor(){super();this.waiting=true;this.capturing=false;this.done=false;this.chunks=[];this.count=0;this.history=[];this.historySize=0;this.meterFrames=0;this.enabled=false;
 this.port.onmessage=({data})=>{if(data.type==='configure'){this.threshold=data.threshold;this.limit=Math.floor(data.limit*sampleRate);this.enabled=true}if(data.type==='stop')this.finish()};}
 finish(){if(this.done)return;this.done=true;const audio=new Float32Array(this.count);let at=0;for(const c of this.chunks){audio.set(c,at);at+=c.length}this.port.postMessage({type:'complete',audio,rate:sampleRate},[audio.buffer]);this.chunks=[];this.history=[];}
 process(inputs){if(this.done)return false;const channels=inputs[0];if(!this.enabled||!channels?.length||!channels[0].length)return true;
 const block=new Float32Array(channels[0].length);let sum=0;for(let i=0;i<block.length;i++){for(const ch of channels)block[i]+=ch[i]/channels.length;sum+=block[i]*block[i]}
 const db=20*Math.log10(Math.max(1e-6,Math.sqrt(sum/block.length)));this.meterFrames+=block.length;
 if(this.meterFrames>=sampleRate/15){this.port.postMessage({type:'level',db});this.meterFrames=0}
 if(this.waiting){if(db>=this.threshold){this.waiting=false;this.capturing=true;for(const c of this.history){this.chunks.push(c);this.count+=c.length}this.history=[];this.port.postMessage({type:'started'});}else{this.history.push(block);this.historySize+=block.length;while(this.historySize>sampleRate*.02&&this.history.length>1)this.historySize-=this.history.shift().length;return true}}
 const remaining=this.limit-this.count;if(remaining>0){const part=block.slice(0,remaining);this.chunks.push(part);this.count+=part.length}if(this.count>=this.limit){this.finish();return false}return true;
 }
}
registerProcessor('hold-capture',HoldCapture);
`;
let captureModule=null;
function recordingUI(){const on=recordHeld||held.has('Backquote');$('record').setAttribute('aria-pressed',on);$('record').textContent=mobileUI?'hold record':'hold record [`]';}
function releaseRecord(){cancelEmptyHolds();recordHeld=false;held.delete('Backquote');recordingUI();finishRecording()}
function disposeCapture(session){clearTimeout(session.countdown);session.input?.disconnect();session.node?.disconnect();$('pad'+session.key).classList.remove('recording','waiting');if(!recorder)releaseMicrophone();}
function resetCapture(session){disposeCapture(session);if(recorder===session){recorder=null;pending=false;recordKey=null;if(!playing)$('play').textContent=mobileUI?'play':'play [space]';releaseMicrophone();$('stopRecord').disabled=true;$('inputLevel').textContent='input: —'}}
async function startRecording(k,mode='hold'){
 if(importing)throw Error('Wait for the audio import to finish.');
 if(recorder||pending){say('Finish the current recording first.');return}
 const limit=$('cycle').checked?p.length*duration():12;
 if(limit>12)throw Error('This cycle exceeds 12 seconds. Shorten it or increase the tempo first.');
 const session={key:k,mode,project:p,state:'opening',limit,threshold:$('thresholdOn').checked?Number($('thresholdDb').value):-Infinity};
 recorder=session;pending=true;recordKey=k;$('play').textContent=mobileUI?'stop':'stop [space / esc]';$('stopRecord').disabled=false;
 $('pad'+k).classList.add('waiting');say(mode==='tap'?'Opening '+k+' · tap pad again to cancel.':'Opening microphone for '+k+' · keep holding…');
 try{
  await audio();
  if(recorder!==session)return;
  const inputStream=await requestMicrophone();
  session.stream=inputStream;
  if(recorder!==session){disposeCapture(session);return}
  if(!captureModule){const url=URL.createObjectURL(new Blob([captureProcessor],{type:'text/javascript'}));captureModule=ctx.audioWorklet.addModule(url).finally(()=>URL.revokeObjectURL(url));captureModule.catch(()=>captureModule=null)}
  await captureModule;
  if(recorder!==session){disposeCapture(session);return}
  session.node=new AudioWorkletNode(ctx,'hold-capture');session.input=ctx.createMediaStreamSource(inputStream);
  // The processor outputs silence. The microphone is never monitored to speakers.
  session.input.connect(session.node);session.node.connect(ctx.destination);
  session.node.onprocessorerror=()=>{if(recorder===session){resetCapture(session);say('Audio capture failed. Release and try again.')}};
  session.node.port.onmessage=guard(async({data})=>{
   if(recorder!==session)return;
   if(data.type==='level'){$('inputLevel').textContent='input: '+Math.round(data.db)+' dBFS';return}
   if(data.type==='started'){if(session.state==='finishing')return;session.state='recording';$('pad'+k).classList.remove('waiting');$('pad'+k).classList.add('recording');say(session.mode==='tap'?'Recording '+k+' · tap pad to stop.':'Recording '+k+' · release to stop.');if($('cycle').checked&&$('metro').checked&&!playing){for(let i=0;i<p.length;i++)click(ctx.currentTime+i*duration(),i===0)}return}
   if(data.type==='complete'){
    session.state='saving';disposeCapture(session);
    try{if(data.audio.length<Math.ceil(data.rate*.01)){say('No sample captured · '+k+' unchanged.');return}
     if(p!==session.project)throw Error('Project changed during capture.');
     const buffer=ctx.createBuffer(1,data.audio.length,data.rate);buffer.copyToChannel(data.audio,0);await install(k,wav(buffer),'mic '+k.toLowerCase());
    }finally{resetCapture(session)}
   }
  });
  const begin=()=>{if(recorder!==session)return;session.state='waiting';say(Number.isFinite(session.threshold)?'Waiting for '+k+' above '+session.threshold+' dBFS · '+(session.mode==='tap'?'tap pad to cancel.':'keep held…'):'Ready to record '+k+' · keep held…');session.node.port.postMessage({type:'configure',threshold:session.threshold,limit:session.limit})};
  if($('cycle').checked){stop();const beat=60/p.bpm;for(let i=0;i<4;i++)click(ctx.currentTime+i*beat,i===0);say('Four-beat count-in for '+k+' · keep held…');session.countdown=setTimeout(begin,beat*4000)}else begin();
 }catch(e){if(recorder===session){resetCapture(session);throw e}else disposeCapture(session)}
}
function finishRecording(){
 const session=recorder;if(!session)return;
 if(session.state==='finishing'||session.state==='saving')return;
 clearTimeout(session.countdown);
 if(session.node){session.state='finishing';session.node.port.postMessage({type:'stop'});say('Finishing '+session.key+'…')}
 else{resetCapture(session);say('Recording cancelled · '+session.key+' unchanged.')}
}
function erase(k){eraseMany([k])}
function eraseMany(keys){keys=keys.filter(k=>p.samples[k]);if(!keys.length)return;undo={samples:{},buffers:{},pattern:p.pattern.map(a=>[...a]),freeNotes:(p.freeNotes||[]).map(n=>({...n}))};for(const k of keys){undo.samples[k]=p.samples[k];undo.buffers[k]=buffers[k];delete p.samples[k];delete buffers[k];delete reversed[k];multiSelected.delete(k)}p.pattern=p.pattern.map(a=>a.filter(k=>!keys.includes(k)));p.freeNotes=(p.freeNotes||[]).filter(n=>!keys.includes(n.key));$('undo').disabled=false;save();render();say(keys.join(', ')+' deleted · Undo available.')}
function wav(buffer){const rate=22050,n=Math.min(Math.floor(buffer.duration*rate),rate*12),data=new ArrayBuffer(44+n*2),v=new DataView(data);const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));for(let i=0;i<n;i++){const at=Math.min(buffer.length-1,Math.floor(i*buffer.sampleRate/rate));let x=0;for(const c of channels)x+=c[at]/channels.length;v.setInt16(44+i*2,Math.max(-1,Math.min(1,x))*32767,true)}return new Blob([data],{type:'audio/wav'})}
$('play').onclick=guard(toggle);$('panic').onclick=()=>{stop();held.clear();resetPadPointers();releaseRecord();resetDelete()};
$('record').onclick=()=>say('Hold this button and a letter, or hold ` + a letter. Release to stop.');
$('record').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();document.activeElement?.blur();recordHeld=true;recordingUI();say('Record held · hold a letter to capture.');$('record').setPointerCapture(e.pointerId)};
$('record').onpointerup=releaseRecord;$('record').onpointercancel=releaseRecord;$('record').onlostpointercapture=releaseRecord;
$('stopRecord').onclick=finishRecording;
$('thresholdDb').oninput=$('thresholdDb').onchange=()=>{const value=Number($('thresholdDb').value);$('thresholdDb').value=Number.isFinite(value)?Math.max(-80,Math.min(0,value)):-35;$('thresholdValue').textContent=$('thresholdDb').value+' dBFS';};
$('clearSelection').onclick=()=>{chosen.clear();renderSteps()};$('clearPattern').onclick=()=>{p.pattern=Array.from({length:32},()=>[]);p.freeNotes=[];save();renderSteps()};$('erase').onclick=()=>erase(selected);$('undo').onclick=()=>{if(!undo)return;Object.assign(p.samples,undo.samples);Object.assign(buffers,undo.buffers);for(const k of Object.keys(undo.samples))delete reversed[k];p.pattern=undo.pattern;p.freeNotes=undo.freeNotes||[];undo=null;$('undo').disabled=true;save();render()};
for(const id of ['bpm','length','division'])$(id).onchange=()=>{const value=Number($(id).value);if(!Number.isFinite(value)||value<(id==='bpm'?30:id==='length'?1:.25)||value>(id==='bpm'?300:id==='length'?32:1)){render();return}p[id]=value;nextStep%=p.length;save();render()};
for(const id of ['sampleName','gain','reverse','start','end','voiceMode'])$(id).onchange=()=>{const s=p.samples[selected];if(!s)return;if(id==='sampleName')s.name=$(id).value||selected;else if(id==='voiceMode')s.voiceMode=$(id).value==='mono'?'mono':'poly';else if(id==='reverse')s.reverse=$(id).checked;else if(id==='gain')s.gain=Number($(id).value);else{const v=Number($(id).value),max=buffers[selected].duration;if(!Number.isFinite(v)||v<0||v>max||(id==='start'?v>=s.end:v<=s.start)){say('Start must be before end, within the sample.');editor();return}s[id]=v}save();render()};
async function importAudio(file,k){
if(!ready)throw Error('Wait for the project to finish loading.');
if(recorder||pending)throw Error('Finish recording first.');
if(importing)throw Error('Wait for the current audio import to finish.');
if(file.size>25e6)throw Error('Choose an audio file smaller than 25 MB.');
if(!file.type.startsWith('audio/')&&!/\.(wav|wave|mp3|m4a|aac|aif|aiff|ogg|oga|opus|webm|flac|mp4)$/i.test(file.name))throw Error('Choose an audio file, such as WAV, MP3, or M4A.');
const target=p;importing=true;selected=k;$('pad'+k).dataset.importing='true';render();say('Loading '+file.name+' onto '+k+'…');
try{await audio();let buffer;try{buffer=await ctx.decodeAudioData(await file.arrayBuffer())}catch{throw Error('This file could not be decoded. Try WAV, MP3, or M4A.')}if(p!==target)throw Error('Project changed. Import the audio again.');await install(k,wav(buffer),file.name.slice(0,20))}finally{importing=false;delete $('pad'+k).dataset.importing}
}
$('import').onclick=()=>{if(recorder||pending||importing){say('Finish the current recording or import first.');return}$('file').click()};$('file').onchange=guard(async()=>{const f=$('file').files[0];$('file').value='';if(f)await importAudio(f,selected)});
// A missed drop must never navigate away from the instrument.
window.addEventListener('dragover',e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='none'}});
window.addEventListener('drop',e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();say('Drop the audio file directly onto a letter.')}});
$('demo').onclick=guard(async()=>{if(!ready)throw Error('Wait for saved samples to finish loading.');if(importing||recorder||pending)throw Error('Finish recording or importing first.');importing=true;try{await audio();for(const k of ['K','S','H']){if(p.samples[k]){if(!buffers[k])await decodeSample(k);continue;}const rate=22050,len=k==='K'?.4:k==='S'?.22:.09,b=ctx.createBuffer(1,rate*len,rate),d=b.getChannelData(0);let phase=0;for(let i=0;i<d.length;i++){const t=i/rate;phase+=2*Math.PI*(45+110*Math.exp(-t*35))/rate;d[i]=k==='K'?Math.sin(phase)*Math.exp(-t*14):(Math.random()*2-1)*Math.exp(-t*(k==='S'?25:65))*.65}await install(k,wav(b),{K:'kick',S:'snare',H:'hat'}[k])}say('K kick · S snare · H hat. Hold 1 + 5 and press K to start a pattern.')}finally{importing=false;render()}});
async function load(n){
 if(loadingProject||importing||recorder)throw Error('Finish the current loading or recording first.');loadingProject=true;
 $('project').disabled=true;stop();finishRecording();resetPadPointers();ready=false;multiSelected.clear();resetDelete();chosen.clear();held.clear();undo=null;$('undo').disabled=true;
 try{const saved=db?await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get(n);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}):null;
 storageReadFailed=false;project=n;p=normalizeProject(saved);for(const k of Object.keys(buffers))delete buffers[k];for(const k of Object.keys(reversed))delete reversed[k];applyBus();render();
 const failed=[];await Promise.all(Object.keys(p.samples).map(async k=>{try{await decodeSample(k)}catch{failed.push(k)}}));
 if(failed.length)say('Could not load '+failed.join(', ')+' · tap a pad to retry, or import audio.');else say('Project '+(project+1)+' ready.');
 }catch(e){storageReadFailed=true;throw e}finally{loadingProject=false;ready=true;$('project').disabled=false;$('project').value=project;render()}
}
$('project').onchange=guard(async()=>{if(!ready||recorder||pending||importing){$('project').value=project;throw Error('Finish recording or importing before switching projects.')}await load(Number($('project').value))});
// One dispatch map keeps mouse actions, shortcuts, and disabled states in sync.
const commands={
KeyB:['bpm','focus'],KeyL:['length','focus'],KeyT:['division','focus'],
KeyK:['quantize','click'],KeyM:['metro','click'],KeyW:['overdub','click'],KeyA:['thresholdOn','click'],KeyF:['thresholdDb','focus'],
Enter:['stopRecord','click'],KeyC:['cycle','click'],KeyD:['demo','click'],
KeyN:['sampleName','focus'],KeyI:['import','click'],KeyX:['deleteMode','click'],
KeyZ:['undo','click'],KeyG:['gain','focus'],KeyV:['reverse','click'],
KeyS:['start','focus'],KeyE:['end','focus'],KeyP:['export','click'],
KeyR:['stopSamples','click'],KeyJ:['voiceMode','focus'],KeyH:['offlineOpen','click'],KeyQ:['clearAll','click'],KeyU:['busOpen','click'],KeyO:['restore','click'],KeyY:['fxOpen','click'],Backspace:['clearPattern','click'],Delete:['clearPattern','click']
};
for(const [code,[id]] of Object.entries(commands))$(id).setAttribute('aria-keyshortcuts','Shift+'+code.replace('Key',''));
$('record').setAttribute('aria-keyshortcuts','Backquote');
$('clearSelection').setAttribute('aria-keyshortcuts','Backslash');
$('panic').setAttribute('aria-keyshortcuts','Escape');
$('play').setAttribute('aria-keyshortcuts','Space');
$('project').setAttribute('aria-keyshortcuts','Shift+1 Shift+2 Shift+3 Shift+4');
$('helpToggle').setAttribute('aria-keyshortcuts','Shift+/');
function runCommand(id,action){const el=$(id);if(el.disabled){say('That control is unavailable for the selected sample or current state.');return}if(action==='focus'){el.focus();if(['text','number'].includes(el.type))el.select();}else el.click()}
function selectAdjacent(direction){selected=letters[(letters.indexOf(selected)+direction+letters.length)%letters.length];multiSelected.clear();multiSelected.add(selected);render()}
window.addEventListener('keydown',guard(async e=>{
if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
const code=e.code;
if(e.target.closest?.('dialog[open]'))return;
if(code==='Escape'){e.preventDefault();$('panic').click();e.target.blur?.();return}
if(e.target.closest?.('dialog[open]'))return;
if(e.target.matches('input,select,textarea,[contenteditable="true"]')){
if(code==='Enter'&&!e.shiftKey){e.preventDefault();e.target.blur()}
return;
}
if(e.repeat||!ready)return;
if(e.shiftKey){
if(/^Digit[1-4]$/.test(code)){e.preventDefault();if(recorder||pending||importing){say('Finish recording or importing before switching projects.');return}$('project').value=Number(code.slice(-1))-1;await $('project').onchange();return}
if(code==='Slash'){e.preventDefault();$('help').open=!$('help').open;return}
if(commands[code]){e.preventDefault();runCommand(...commands[code]);return}
// Unassigned Shift combinations must never accidentally play or erase a sample.
return;
}
if(code==='BracketLeft'||code==='BracketRight'){e.preventDefault();setStepPage(stepPage+(code==='BracketRight'?1:-1));return}
if(code==='Backslash'){e.preventDefault();$('clearSelection').click();return}
if(code==='ArrowLeft'||code==='ArrowRight'){e.preventDefault();selectAdjacent(code==='ArrowLeft'?-1:1);return}
if(code==='Space'){e.preventDefault();await toggle();return}
if(['Backquote','Backspace','Delete'].includes(code)||/^Digit\d$/.test(code)){e.preventDefault();held.add(code);if(code==='Backquote'){recordingUI();say('Record held · hold a letter to capture.')}renderSteps();return}
if(/^Key[A-Z]$/.test(code)){e.preventDefault();held.add(code);const k=code.slice(3);if(!p.samples[k]&&!recorder&&deleteMode==='off')keyCaptureStarted.set(k,gestureTime(e));await activatePad(k);if(recordKey===k&&recorder?.mode!=='tap'&&!held.has(code))finishRecording()}
}));
window.addEventListener('keyup',e=>{held.delete(e.code);if(/^Key[A-Z]$/.test(e.code)){const k=e.code.slice(3),started=keyCaptureStarted.get(k);keyCaptureStarted.delete(k);if(started!==undefined&&gestureTime(e)-started>=HOLD_GESTURE_MS&&recordKey===k)finishRecording();}renderSteps();if(e.code==='Backquote')recordingUI();if(recordKey&&recorder?.mode!=='tap'&&(e.code==='Key'+recordKey||e.code==='Backquote'))finishRecording()});
window.addEventListener('blur',()=>{resetPadPointers();held.clear();renderSteps();releaseRecord()});
$('export').onclick=guard(async()=>{const out={format:'letter-sampler-1',...p,samples:{}};for(const[k,s]of Object.entries(p.samples)){const bytes=new Uint8Array(await s.blob.arrayBuffer());let str='';for(const v of bytes)str+=String.fromCharCode(v);out.samples[k]={...s,blob:undefined,type:s.blob.type,data:btoa(str)}}const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.href=url;a.download='letter-sampler-project-'+(project+1)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('restore').onclick=()=>$('backup').click();$('backup').onchange=guard(async()=>{const f=$('backup').files[0];$('backup').value='';if(!f)return;if(!ready||recorder||pending||importing)throw Error('Finish loading, recording or importing first.');if(f.size>30e6)throw Error('Backup is too large.');const x=JSON.parse(await f.text());if(x.format!=='letter-sampler-1'||!Number.isFinite(x.bpm)||x.bpm<30||x.bpm>300||!Number.isInteger(x.length)||x.length<1||x.length>32||![1,.5,.25].includes(x.division)||!Array.isArray(x.pattern)||![10,32].includes(x.pattern.length)||!x.pattern.every(a=>Array.isArray(a)&&a.every(k=>letters.includes(k)&&k.length===1))||!x.samples)throw Error('Invalid project backup.');if(x.freeNotes!==undefined&&(!Array.isArray(x.freeNotes)||x.freeNotes.length>4096||!x.freeNotes.every(validFreeNote)))throw Error('Invalid live timing data.');await audio();const decoded={};for(const[k,s]of Object.entries(x.samples)){if(k.length!==1||!letters.includes(k)||typeof s.name!=='string')throw Error('Invalid sample.');s.blob=new Blob([Uint8Array.from(atob(s.data),c=>c.charCodeAt(0))],{type:s.type});decoded[k]=await decodeStoredAudio(s.blob);if((s.voiceMode!==undefined&&!['mono','poly'].includes(s.voiceMode))||(s.compression!==undefined&&![0,4,8,20].includes(s.compression))||(s.pitch!==undefined&&(!Number.isFinite(s.pitch)||Math.abs(s.pitch)>24))||(s.cutoff!==undefined&&(!Number.isFinite(s.cutoff)||s.cutoff<200||s.cutoff>20000))||(s.pan!==undefined&&(!Number.isFinite(s.pan)||Math.abs(s.pan)>1)))throw Error('Invalid effects settings.');if(decoded[k].duration>12.5||![s.start,s.end,s.gain].every(Number.isFinite)||s.start<0||s.end>decoded[k].duration+.001||s.end<=s.start||s.gain<0||s.gain>1.5)throw Error('Invalid sample settings.');delete s.data;delete s.type}if(!confirm('Replace project '+(project+1)+' with this backup?'))return;stop();p=normalizeProject(x);applyBus();for(const k of Object.keys(buffers))delete buffers[k];for(const k of Object.keys(reversed))delete reversed[k];Object.assign(buffers,decoded);chosen.clear();held.clear();resetDelete();undo=null;$('undo').disabled=true;save();render();say('Project restored.')});
render();const opening=indexedDB.open('letter-sampler',1);
opening.onupgradeneeded=()=>opening.result.createObjectStore('projects');
opening.onerror=()=>{ready=true;$('saved').textContent='storage unavailable · export to keep work'};
opening.onsuccess=()=>{db=opening.result;load(0).then(()=>{$('saved').textContent='saved in this browser'}).catch(e=>{fail(e);$('saved').textContent='loading failed · saved data retained'})};

function parkAudio(){
 rebuildOnGesture=true;audioUnlock=null;resetPadPointers();held.clear();recordHeld=false;stop();recordingUI();
 // A suspended worklet may never acknowledge stop. Cancel unfinished capture
 // immediately so it cannot trap the instrument in "finishing" after unlock.
 if(recorder&&recorder.state!=='saving'){resetCapture(recorder);say('Recording interrupted · unfinished take cancelled. Saved samples kept.')}
 releaseMicrophone();
}
window.addEventListener('pagehide',parkAudio);
window.addEventListener('pageshow',event=>{if(event.persisted){rebuildOnGesture=true;say('Tap a pad or Play to reconnect audio.')}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)parkAudio();else if(rebuildOnGesture)say('Tap a pad or Play to reconnect audio.')});
