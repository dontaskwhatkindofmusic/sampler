'use strict';
let deleteHoldTimer=null,deleteLongPress=false;
function toggleDelete(){
 if(recorder||importing){say('Finish recording or importing first.');return}
 if(deleteMode!=='off'){
  const keys=deleteMode==='bulk'?[...deleteSelection]:deleteCandidate?[deleteCandidate]:[];
  if(keys.length)eraseMany(keys);else say('Delete cancelled.');resetDelete();return;
 }
 deleteMode='single';deleteCandidate=null;renderDelete();say('Select a pad · tap Delete to remove.');
}
$('deleteMode').onclick=e=>{if(e.detail>0&&deleteLongPress){deleteLongPress=false;return}toggleDelete()};
$('deleteMode').onpointerdown=e=>{if(e.button!==0)return;deleteLongPress=false;$('deleteMode').setPointerCapture(e.pointerId);deleteHoldTimer=setTimeout(()=>{if(recorder||importing)return;deleteLongPress=true;deleteMode='bulk';deleteCandidate=null;deleteSelection.clear();renderDelete();say('Select pads · tap Delete to remove them.');},400)};
$('deleteMode').onpointerup=()=>clearTimeout(deleteHoldTimer);
$('deleteMode').onpointercancel=()=>{clearTimeout(deleteHoldTimer);deleteLongPress=true};
$('deleteMode').oncontextmenu=e=>e.preventDefault();
$('erase').onclick=()=>{if(recorder||importing){say('Finish recording first.');return}if(deleteMode!=='off'){toggleDelete();return}if(!p.samples[selected])return;deleteMode='single';deleteCandidate=selected;renderDelete();say(selected+' selected · tap Delete to remove.')};
// Effects are built from native Web Audio nodes and saved with each sample.
$('fxOpen').onclick=()=>{
 const keys=mobileUI&&multiSelected.size?[...multiSelected].filter(k=>p.samples[k]):[selected].filter(k=>p.samples[k]);
 if(!keys.length){say('Select a recorded pad first.');return}
 $('fxDialog').effectKeys=keys;$('fxTitle').textContent='effects · '+keys.join(' ');
 const s=p.samples[keys.at(-1)];$('fxPitch').value=s.pitch||0;$('fxCutoff').value=s.cutoff??20000;$('fxPan').value=s.pan||0;updateFxLabels();$('fxDialog').showModal();
};
function updateFxLabels(){$('pitchValue').textContent=$('fxPitch').value+' st';$('cutoffValue').textContent=Number($('fxCutoff').value)>=20000?'off':$('fxCutoff').value+' Hz';$('panValue').textContent=Number($('fxPan').value)===0?'center':$('fxPan').value}
for(const id of ['fxPitch','fxCutoff','fxPan'])$(id).oninput=updateFxLabels;
$('fxReset').onclick=()=>{$('fxPitch').value=0;$('fxCutoff').value=20000;$('fxPan').value=0;updateFxLabels()};
$('fxApply').onclick=()=>{for(const k of $('fxDialog').effectKeys||[]){const s=p.samples[k];if(s)Object.assign(s,{pitch:Number($('fxPitch').value),cutoff:Number($('fxCutoff').value),pan:Number($('fxPan').value)})}save();$('fxDialog').close();say('Effects saved · applied on the next hit.')};
$('fxClose').onclick=()=>$('fxDialog').close();
async function checkMic(){
 if(recorder){say('Finish recording before checking the microphone.');return}
 await requestMicrophone();if(!recorder){releaseMicrophone();say('Microphone permission checked · ready to record.');}
}
$('micCheck').onclick=guard(checkMic);
// Permission can persist without keeping the capture stream open. iOS may lower
// playback volume while a microphone stream is live, so idle streams are closed.
if(typeof navigator!=='undefined')checkMic().catch(()=>{if(!recorder)releaseMicrophone();say('Microphone not enabled. Tap an empty pad to request access.')});
