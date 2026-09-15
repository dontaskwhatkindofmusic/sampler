 'use strict';
function toggleDelete(){
 if(recorder||importing){say('Finish recording or importing first.');return}
 if(deleteMode!=='off'){const keys=[...deleteSelection];if(keys.length)eraseMany(keys);else say('Delete cancelled.');resetDelete();return}
 deleteMode='bulk';deleteSelection.clear();renderDelete();say('Select pads · tap Delete to remove.');
}
$('deleteMode').onclick=toggleDelete;
$('erase').onclick=()=>{if(mobileUI&&deleteMode==='off')document.querySelector('[data-view="play"]').click();toggleDelete()};
// Effects are built from native Web Audio nodes and saved with each sample.
$('fxOpen').onclick=()=>{
 const keys=mobileUI&&multiSelected.size?[...multiSelected].filter(k=>p.samples[k]):[selected].filter(k=>p.samples[k]);
 if(!keys.length){say('Select a recorded pad first.');return}
 $('fxDialog').effectKeys=keys;$('fxTitle').textContent='effects · '+keys.join(' ');
 const s=p.samples[keys.at(-1)];$('fxPitch').value=s.pitch||0;$('fxCutoff').value=s.cutoff??20000;$('fxPan').value=s.pan||0;$('fxComp').value=s.compression||0;updateFxLabels();$('fxDialog').showModal();
};
function updateFxLabels(){$('pitchValue').textContent=$('fxPitch').value+' st';$('cutoffValue').textContent=Number($('fxCutoff').value)>=20000?'off':$('fxCutoff').value+' Hz';$('panValue').textContent=Number($('fxPan').value)===0?'center':$('fxPan').value}
for(const id of ['fxPitch','fxCutoff','fxPan'])$(id).oninput=updateFxLabels;
$('fxReset').onclick=()=>{$('fxPitch').value=0;$('fxCutoff').value=20000;$('fxPan').value=0;$('fxComp').value=0;updateFxLabels()};
$('fxApply').onclick=()=>{for(const k of $('fxDialog').effectKeys||[]){const s=p.samples[k];if(s)Object.assign(s,{pitch:Number($('fxPitch').value),cutoff:Number($('fxCutoff').value),pan:Number($('fxPan').value),compression:Number($('fxComp').value)})}save();$('fxDialog').close();say('Effects saved · applied on the next hit.')};
$('fxClose').onclick=()=>$('fxDialog').close();
async function checkMic(){
 if(recorder){say('Finish recording before checking the microphone.');return}
 await requestMicrophone();if(!recorder){releaseMicrophone();say('Microphone permission checked · ready to record.');}
}
$('micCheck').onclick=guard(checkMic);
// Request only on a recording gesture or an explicit microphone check.
$('busOpen').onclick=()=>{const b=p.bus||busDefaults();$('busGain').value=b.gain;$('busComp').checked=b.compressor;$('busThreshold').value=b.threshold;$('busRatio').value=b.ratio;busLabels();$('busDialog').showModal()};
function busLabels(){for(const id of ['busGain','busThreshold','busRatio'])$(id+'Value').textContent=$(id).value}
for(const id of ['busGain','busThreshold','busRatio'])$(id).oninput=busLabels;
$('busApply').onclick=()=>{p.bus={gain:Number($('busGain').value),compressor:$('busComp').checked,threshold:Number($('busThreshold').value),ratio:Number($('busRatio').value)};applyBus();save();$('busDialog').close();say('Master settings saved.')};
$('busClose').onclick=()=>$('busDialog').close();

$('clearAll').onclick=()=>{
 if(!ready||recorder||importing){say('Finish loading, recording or importing first.');return}
 const keys=Object.keys(p.samples);if(!keys.length){say('All pads are already empty.');return}
 if(!confirm('Clear all pads in project '+(project+1)+'? Undo can restore them.'))return;
 $('panic').click();chosen.clear();eraseMany(keys);say('All pads cleared in project '+(project+1)+' · Undo available.');
};
$('undoAll').onclick=()=>$('undo').click();
