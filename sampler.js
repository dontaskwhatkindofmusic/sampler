'use strict';
const mobileUI=document.documentElement?.dataset.mobile==='true';
const $=id=>document.getElementById(id), letters='QWERTYUIOPASDFGHJKLZXCVBNM';
const fresh=()=>({bpm:110,length:8,division:1,samples:{},pattern:Array.from({length:10},()=>[])});
let p=fresh(), project=0, db, ctx, master, selected='K', ready=false, playing=false, timer, nextTime=0, nextStep=0, origin=0, recordHeld=false, recorder=null, recordKey=null, pending=false, undo=null, importing=false;
const buffers={}, reversed={}, held=new Set(), chosen=new Set(), voices=new Set(), visuals=new Set();
const say=t=>$('status').textContent=t;
const fail=e=>say(e.message||String(e));
const guard=fn=>(...args)=>{try{return Promise.resolve(fn(...args)).catch(fail)}catch(e){fail(e)}};
const emptyHolds=new Map();
const emptyHint=k=>k+' is empty. Hold to record or import audio to this letter.';
function cancelEmptyHold(k,token){const hold=emptyHolds.get(k);if(!hold||(token!==undefined&&hold.token!==token))return;clearTimeout(hold.timer);emptyHolds.delete(k);$('pad'+k).classList.remove('holding')}
function cancelEmptyHolds(){for(const k of emptyHolds.keys())cancelEmptyHold(k)}
function beginEmptyHold(k,token){
 if(!ready||p.samples[k]||recorder||importing||emptyHolds.has(k))return;
 const projectAtPress=p;const hold={token,timer:null};emptyHolds.set(k,hold);selected=k;render();say(emptyHint(k));$('pad'+k).classList.add('holding');
 // Unlock audio in the original gesture; do not request the microphone on a tap.
 audio().catch(fail);
 hold.timer=setTimeout(guard(async()=>{
  if(emptyHolds.get(k)!==hold)return;cancelEmptyHold(k,token);
  if(p!==projectAtPress||p.samples[k]||recorder||importing||!ready)return;
  await startRecording(k);
 }),2000);
}
for(let n=1;n<=10;n++)$('length').add(new Option(n,n));
for(const row of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){const div=document.createElement('div');div.className='row';for(const k of row){const b=document.createElement('button');b.id='pad'+k;b.innerHTML=k+'<small>—</small>';b.onclick=guard(e=>{if(e?.detail>0&&b.suppressClick)return;return perform(k)});
b.onpointerdown=guard(async e=>{
 if(e.button!==0||b.activePointer!=null)return;
 const recording=recordHeld||held.has('Backquote');
 const empty=!p.samples[k]&&!held.has('Backspace')&&!held.has('Delete');
 if(!recording&&!empty&&e.pointerType!=='touch'&&e.pointerType!=='pen'){b.suppressClick=false;return}
 e.preventDefault();b.activePointer=e.pointerId;b.suppressClick=true;b.capturePointer=recording||empty?e.pointerId:null;b.setPointerCapture(e.pointerId);
 if(empty&&!recording){beginEmptyHold(k,'pointer:'+e.pointerId);return}
 await perform(k);
});
const releasePad=e=>{if(b.activePointer!==e.pointerId)return;b.activePointer=null;cancelEmptyHold(k,'pointer:'+e.pointerId);if(b.capturePointer===e.pointerId){b.capturePointer=null;if(recordKey===k)finishRecording()}};
b.onpointerup=releasePad;b.onpointercancel=releasePad;b.onlostpointercapture=releasePad;
b.ondragover=e=>{if(!Array.from(e.dataTransfer?.types||[]).includes('Files'))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=ready&&!recorder&&!pending&&!importing?'copy':'none';b.classList.add('dragover')};
b.ondragleave=e=>{if(!b.contains(e.relatedTarget))b.classList.remove('dragover')};
b.ondrop=guard(async e=>{e.preventDefault();e.stopPropagation();b.classList.remove('dragover');const files=Array.from(e.dataTransfer?.files||[]);if(files.length!==1)throw Error('Drop one audio file onto a letter at a time.');await importAudio(files[0],k)});
div.append(b)}$('keyboard').append(div)}
for(let i=0;i<10;i++){const b=document.createElement('button');b.innerHTML=(i+1)%10+'<span>—</span>';b.onclick=()=>{chosen.has(i)?chosen.delete(i):chosen.add(i);renderSteps()};$('steps').append(b)}
async function audio(){if(!ctx){ctx=new AudioContext({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=.65;const limit=ctx.createDynamicsCompressor();master.connect(limit).connect(ctx.destination)}if(ctx.state!=='running')await ctx.resume()}
function save(){if(!db){$('saved').textContent='not saved · storage unavailable';return}const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(p,project);$('saved').textContent='saving…';tx.oncomplete=()=>$('saved').textContent='saved in this browser';tx.onerror=()=>{$('saved').textContent='save failed · export a backup';fail(tx.error)}}
function renderSteps(){[...$('steps').children].forEach((b,i)=>{b.disabled=i>=p.length;b.setAttribute('aria-pressed',chosen.has(i)||held.has('Digit'+((i+1)%10)));b.querySelector('span').textContent=p.pattern[i].join('').toLowerCase()||'—';b.title='Step '+(i+1)+': '+(p.pattern[i].join(', ')||'empty')});$('meter').textContent='· '+(p.length*p.division/4)+' bars of 4/4'}
function render(){for(const k of letters){const b=$('pad'+k),s=p.samples[k];b.dataset.loaded=!!s;b.setAttribute('aria-pressed',selected===k);b.querySelector('small').textContent=s?s.name:'—';b.title=k+(s?' · '+s.name:' · empty')}$('bpm').value=p.bpm;$('length').value=p.length;$('division').value=p.division;renderSteps();editor()}
function editor(){const s=p.samples[selected];$('selected').textContent='selected: '+selected+(mobileUI?'':' [←/→]');$('sampleName').value=s?.name||'';$('gain').value=s?.gain??1;$('reverse').checked=s?.reverse||false;$('start').value=s?.start||0;$('end').value=s?.end||0;$('size').textContent=s?(s.blob.size/1024).toFixed(1)+' KB · '+buffers[selected]?.duration.toFixed(2)+' s':'empty';for(const id of ['sampleName','gain','reverse','start','end','erase'])$(id).disabled=!s}
function flash(k,when){const handle=setTimeout(()=>{visuals.delete(handle);const b=$('pad'+k);b.classList.add('hit');setTimeout(()=>b.classList.remove('hit'),90)},Math.max(0,(when-ctx.currentTime)*1000));visuals.add(handle)}
function trigger(k,when=ctx.currentTime){const s=p.samples[k],buf=buffers[k];if(!s||!buf)return;const source=ctx.createBufferSource(),gain=ctx.createGain();let data=buf,offset=s.start;if(s.reverse){if(!reversed[k]){const b=ctx.createBuffer(1,buf.length,buf.sampleRate);b.copyToChannel(Float32Array.from(buf.getChannelData(0)).reverse(),0);reversed[k]=b}data=reversed[k];offset=buf.duration-s.end}source.buffer=data;gain.gain.value=s.gain;source.connect(gain).connect(master);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect()};source.start(when,Math.max(0,offset),Math.max(.005,s.end-s.start));flash(k,when)}
function click(when,accent){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=accent?1400:950;g.gain.setValueAtTime(.12,when);g.gain.exponentialRampToValueAtTime(.001,when+.035);o.connect(g).connect(master);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect()};o.start(when);o.stop(when+.04)}
const duration=()=>60/p.bpm*p.division;
function schedule(){while(playing&&nextTime<ctx.currentTime+.10){const step=nextStep,t=nextTime;for(const k of p.pattern[step])trigger(k,t);if($('metro').checked)click(t,step===0);const handle=setTimeout(()=>{visuals.delete(handle);[...$('steps').children].forEach((b,i)=>b.classList.toggle('now',i===step))},Math.max(0,(t-ctx.currentTime)*1000));visuals.add(handle);nextTime+=duration();nextStep=(nextStep+1)%p.length}}
function stop(){playing=false;clearInterval(timer);for(const s of voices){try{s.stop()}catch{}}voices.clear();for(const h of visuals)clearTimeout(h);visuals.clear();$('play').textContent=mobileUI?'play':'play [space]';for(const b of $('steps').children)b.classList.remove('now')}
async function toggle(){if(!ready)return;if(playing){stop();return}await audio();playing=true;origin=nextTime=ctx.currentTime+.03;nextStep=0;$('play').textContent=mobileUI?'stop':'stop [space]';schedule();timer=setInterval(schedule,25)}
async function perform(k){if(!ready)return;selected=k;render();if(held.has('Backspace')||held.has('Delete')){erase(k);return}if(recordHeld||held.has('Backquote')){await startRecording(k);return}const steps=new Set(chosen);for(let i=0;i<p.length;i++)if(held.has('Digit'+((i+1)%10)))steps.add(i);if(steps.size){if(!p.samples[k]){say(emptyHint(k));return}for(const i of steps){if(i>=p.length)continue;const row=p.pattern[i],at=row.indexOf(k);at<0?row.push(k):row.splice(at,1)}save();renderSteps();return}await audio();if(!buffers[k]){say(emptyHint(k));return}trigger(k);if(playing&&$('overdub').checked){const step=((Math.round((ctx.currentTime-origin)/duration())%p.length)+p.length)%p.length;if(!p.pattern[step].includes(k))p.pattern[step].push(k);save();renderSteps()}}
async function install(k,blob,name){cancelEmptyHold(k);const target=p;const buffer=await ctx.decodeAudioData(await blob.arrayBuffer());if(p!==target)throw Error('Project changed before audio was ready. Import it again.');if(buffer.duration<.01)throw Error('Recording was too short. Try again.');buffers[k]=buffer;delete reversed[k];p.samples[k]={blob,name,start:0,end:buffer.duration,gain:1,reverse:false};save();render();say(k+' ready · '+buffer.duration.toFixed(2)+' seconds.')}
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
function disposeCapture(session){clearTimeout(session.countdown);session.input?.disconnect();session.node?.disconnect();session.stream?.getTracks().forEach(t=>t.stop());$('pad'+session.key).classList.remove('recording','waiting');}
function resetCapture(session){disposeCapture(session);if(recorder===session){recorder=null;pending=false;recordKey=null;$('stopRecord').disabled=true;$('inputLevel').textContent='input: —'}}
async function startRecording(k){
 if(importing)throw Error('Wait for the audio import to finish.');
 if(recorder||pending){say('Finish the current recording first.');return}
 const limit=$('cycle').checked?p.length*duration():12;
 if(limit>12)throw Error('This cycle exceeds 12 seconds. Shorten it or increase the tempo first.');
 const session={key:k,project:p,state:'opening',limit,threshold:$('thresholdOn').checked?Number($('thresholdDb').value):-Infinity};
 recorder=session;pending=true;recordKey=k;$('stopRecord').disabled=false;
 $('pad'+k).classList.add('waiting');say('Opening microphone for '+k+' · keep holding…');
 try{
  await audio();
  if(recorder!==session)return;
  const inputStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
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
   if(data.type==='started'){if(session.state==='finishing')return;session.state='recording';$('pad'+k).classList.remove('waiting');$('pad'+k).classList.add('recording');say('Recording '+k+' · release to stop.');if($('cycle').checked&&$('metro').checked&&!playing){for(let i=0;i<p.length;i++)click(ctx.currentTime+i*duration(),i===0)}return}
   if(data.type==='complete'){
    session.state='saving';disposeCapture(session);
    try{if(data.audio.length<Math.ceil(data.rate*.01)){say('No sample captured · '+k+' unchanged.');return}
     if(p!==session.project)throw Error('Project changed during capture.');
     const buffer=ctx.createBuffer(1,data.audio.length,data.rate);buffer.copyToChannel(data.audio,0);await install(k,wav(buffer),'mic '+k.toLowerCase());
    }finally{resetCapture(session)}
   }
  });
  const begin=()=>{if(recorder!==session)return;session.state='waiting';say(Number.isFinite(session.threshold)?'Waiting for '+k+' above '+session.threshold+' dBFS · keep held…':'Ready to record '+k+' · keep held…');session.node.port.postMessage({type:'configure',threshold:session.threshold,limit:session.limit})};
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
function erase(k){if(!p.samples[k])return;undo={k,s:p.samples[k],buffer:buffers[k],pattern:p.pattern.map(a=>[...a])};delete p.samples[k];delete buffers[k];delete reversed[k];p.pattern=p.pattern.map(a=>a.filter(x=>x!==k));$('undo').disabled=false;save();render();say(k+' deleted. Undo is available.')}
function wav(buffer){const rate=22050,n=Math.min(Math.floor(buffer.duration*rate),rate*12),data=new ArrayBuffer(44+n*2),v=new DataView(data);const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));for(let i=0;i<n;i++){const at=Math.min(buffer.length-1,Math.floor(i*buffer.sampleRate/rate));let x=0;for(const c of channels)x+=c[at]/channels.length;v.setInt16(44+i*2,Math.max(-1,Math.min(1,x))*32767,true)}return new Blob([data],{type:'audio/wav'})}
$('play').onclick=guard(toggle);$('panic').onclick=()=>{stop();held.clear();releaseRecord()};
$('record').onclick=()=>say('Hold this button and a letter, or hold ` + a letter. Release to stop.');
$('record').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();document.activeElement?.blur();recordHeld=true;recordingUI();say('Record held · hold a letter to capture.');$('record').setPointerCapture(e.pointerId)};
$('record').onpointerup=releaseRecord;$('record').onpointercancel=releaseRecord;$('record').onlostpointercapture=releaseRecord;
$('stopRecord').onclick=finishRecording;
$('thresholdDb').onchange=()=>{const value=Number($('thresholdDb').value);$('thresholdDb').value=Number.isFinite(value)?Math.max(-80,Math.min(0,value)):-35;};
$('clearSelection').onclick=()=>{chosen.clear();renderSteps()};$('clearPattern').onclick=()=>{p.pattern=Array.from({length:10},()=>[]);save();renderSteps()};$('erase').onclick=()=>erase(selected);$('undo').onclick=()=>{if(!undo)return;p.samples[undo.k]=undo.s;buffers[undo.k]=undo.buffer;p.pattern=undo.pattern;undo=null;$('undo').disabled=true;save();render()};
for(const id of ['bpm','length','division'])$(id).onchange=()=>{const value=Number($(id).value);if(!Number.isFinite(value)||value<(id==='bpm'?30:id==='length'?1:.25)||value>(id==='bpm'?300:id==='length'?10:1)){render();return}stop();p[id]=value;save();render()};
for(const id of ['sampleName','gain','reverse','start','end'])$(id).onchange=()=>{const s=p.samples[selected];if(!s)return;if(id==='sampleName')s.name=$(id).value||selected;else if(id==='reverse')s.reverse=$(id).checked;else if(id==='gain')s.gain=Number($(id).value);else{const v=Number($(id).value),max=buffers[selected].duration;if(!Number.isFinite(v)||v<0||v>max||(id==='start'?v>=s.end:v<=s.start)){say('Start must be before end, within the sample.');editor();return}s[id]=v}save();render()};
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
$('demo').onclick=guard(async()=>{if(importing)throw Error('Wait for the audio import to finish.');await audio();for(const k of ['K','S','H']){if(p.samples[k])continue;const rate=22050,len=k==='K'?.4:k==='S'?.22:.09,b=ctx.createBuffer(1,rate*len,rate),d=b.getChannelData(0);let phase=0;for(let i=0;i<d.length;i++){const t=i/rate;phase+=2*Math.PI*(45+110*Math.exp(-t*35))/rate;d[i]=k==='K'?Math.sin(phase)*Math.exp(-t*14):(Math.random()*2-1)*Math.exp(-t*(k==='S'?25:65))*.65}await install(k,wav(b),{K:'kick',S:'snare',H:'hat'}[k])}say('K kick · S snare · H hat. Hold 1 + 5 and press K to start a pattern.')});
async function load(n){cancelEmptyHolds();$('project').disabled=true;stop();finishRecording();ready=false;project=n;chosen.clear();held.clear();undo=null;$('undo').disabled=true;for(const k of Object.keys(buffers))delete buffers[k];for(const k of Object.keys(reversed))delete reversed[k];p=db?await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get(n);r.onsuccess=()=>resolve(r.result||fresh());r.onerror=()=>reject(r.error)}):fresh();await audio();for(const [k,s]of Object.entries(p.samples)){try{buffers[k]=await ctx.decodeAudioData(await s.blob.arrayBuffer())}catch{say('Could not decode '+k+'. Re-import its audio.')}}ready=true;$('project').disabled=false;render()}
$('project').onchange=guard(async()=>{if(recorder||pending||importing){$('project').value=project;throw Error('Finish recording or importing before switching projects.')}await load(Number($('project').value));say('Project '+(project+1)+' ready.')});
// One dispatch map keeps mouse actions, shortcuts, and disabled states in sync.
const commands={
KeyB:['bpm','focus'],KeyL:['length','focus'],KeyT:['division','focus'],
KeyM:['metro','click'],KeyW:['overdub','click'],KeyA:['thresholdOn','click'],KeyF:['thresholdDb','focus'],
Enter:['stopRecord','click'],KeyC:['cycle','click'],KeyD:['demo','click'],
KeyN:['sampleName','focus'],KeyI:['import','click'],KeyX:['erase','click'],
KeyZ:['undo','click'],KeyG:['gain','focus'],KeyV:['reverse','click'],
KeyS:['start','focus'],KeyE:['end','focus'],KeyP:['export','click'],
KeyO:['restore','click'],Backspace:['clearPattern','click'],Delete:['clearPattern','click']
};
for(const [code,[id]] of Object.entries(commands))$(id).setAttribute('aria-keyshortcuts','Shift+'+code.replace('Key',''));
$('record').setAttribute('aria-keyshortcuts','Backquote');
$('clearSelection').setAttribute('aria-keyshortcuts','Backslash');
$('panic').setAttribute('aria-keyshortcuts','Escape');
$('play').setAttribute('aria-keyshortcuts','Space');
$('project').setAttribute('aria-keyshortcuts','Shift+1 Shift+2 Shift+3 Shift+4');
$('helpToggle').setAttribute('aria-keyshortcuts','Shift+/');
function runCommand(id,action){const el=$(id);if(el.disabled){say('That control is unavailable for the selected sample or current state.');return}if(action==='focus'){el.focus();if(['text','number'].includes(el.type))el.select();}else el.click()}
function selectAdjacent(direction){selected=letters[(letters.indexOf(selected)+direction+letters.length)%letters.length];render()}
window.addEventListener('keydown',guard(async e=>{
if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
const code=e.code;
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
if(code==='Backslash'){e.preventDefault();$('clearSelection').click();return}
if(code==='ArrowLeft'||code==='ArrowRight'){e.preventDefault();selectAdjacent(code==='ArrowLeft'?-1:1);return}
if(code==='Space'){e.preventDefault();await toggle();return}
if(['Backquote','Backspace','Delete'].includes(code)||/^Digit\d$/.test(code)){e.preventDefault();held.add(code);if(code==='Backquote'){recordingUI();say('Record held · hold a letter to capture.')}renderSteps();return}
if(/^Key[A-Z]$/.test(code)){e.preventDefault();held.add(code);const k=code.slice(3);if(!p.samples[k]&&!recordHeld&&!held.has('Backquote')&&!held.has('Backspace')&&!held.has('Delete')){beginEmptyHold(k,code);return}await perform(k);if(recordKey===code.slice(3)&&!held.has(code))finishRecording()}
}));
window.addEventListener('keyup',e=>{held.delete(e.code);if(/^Key[A-Z]$/.test(e.code))cancelEmptyHold(e.code.slice(3),e.code);renderSteps();if(e.code==='Backquote')recordingUI();if(recordKey&&(e.code==='Key'+recordKey||e.code==='Backquote'))finishRecording()});
window.addEventListener('blur',()=>{held.clear();renderSteps();releaseRecord()});
$('export').onclick=guard(async()=>{const out={format:'letter-sampler-1',...p,samples:{}};for(const[k,s]of Object.entries(p.samples)){const bytes=new Uint8Array(await s.blob.arrayBuffer());let str='';for(const v of bytes)str+=String.fromCharCode(v);out.samples[k]={...s,blob:undefined,type:s.blob.type,data:btoa(str)}}const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.href=url;a.download='letter-sampler-project-'+(project+1)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('restore').onclick=()=>$('backup').click();$('backup').onchange=guard(async()=>{const f=$('backup').files[0];$('backup').value='';if(!f)return;if(recorder||pending||importing)throw Error('Finish recording or importing first.');if(f.size>30e6)throw Error('Backup is too large.');const x=JSON.parse(await f.text());if(x.format!=='letter-sampler-1'||!Number.isFinite(x.bpm)||x.bpm<30||x.bpm>300||!Number.isInteger(x.length)||x.length<1||x.length>10||![1,.5,.25].includes(x.division)||!Array.isArray(x.pattern)||x.pattern.length!==10||!x.pattern.every(a=>Array.isArray(a)&&a.every(k=>letters.includes(k)&&k.length===1))||!x.samples)throw Error('Invalid project backup.');await audio();const decoded={};for(const[k,s]of Object.entries(x.samples)){if(k.length!==1||!letters.includes(k)||typeof s.name!=='string')throw Error('Invalid sample.');s.blob=new Blob([Uint8Array.from(atob(s.data),c=>c.charCodeAt(0))],{type:s.type});decoded[k]=await ctx.decodeAudioData(await s.blob.arrayBuffer());if(decoded[k].duration>12.5||![s.start,s.end,s.gain].every(Number.isFinite)||s.start<0||s.end>decoded[k].duration+.001||s.end<=s.start||s.gain<0||s.gain>1.5)throw Error('Invalid sample settings.');delete s.data;delete s.type}if(!confirm('Replace project '+(project+1)+' with this backup?'))return;stop();p=x;for(const k of Object.keys(buffers))delete buffers[k];for(const k of Object.keys(reversed))delete reversed[k];Object.assign(buffers,decoded);undo=null;$('undo').disabled=true;save();render();say('Project restored.')});
render();const opening=indexedDB.open('letter-sampler',1);opening.onupgradeneeded=()=>opening.result.createObjectStore('projects');opening.onerror=()=>{ready=true;$('saved').textContent='storage unavailable · export to keep work'};opening.onsuccess=()=>{db=opening.result;const r=db.transaction('projects').objectStore('projects').get(0);r.onsuccess=async()=>{p=r.result||fresh();if(Object.keys(p.samples).length){ctx=new AudioContext({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=.65;const limit=ctx.createDynamicsCompressor();master.connect(limit).connect(ctx.destination);for(const[k,s]of Object.entries(p.samples)){try{buffers[k]=await ctx.decodeAudioData(await s.blob.arrayBuffer())}catch{say('Could not decode '+k+'.')}}}ready=true;render();$('saved').textContent='saved in this browser'}};

document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();held.clear();releaseRecord()}});
