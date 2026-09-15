if (mobileUI) {
'use strict';
let mobileBank=0, mobileView='play';
const fields=new Map();
function syncMobile(){
 for(const [input,button] of fields){button.textContent=input.value||'—';button.disabled=input.disabled;button.setAttribute('aria-label',button.dataset.label+': '+(input.value||'empty'))}
 [...letters].forEach((k,i)=>{$('pad'+k).hidden=Math.floor(i/9)!==mobileBank});
 document.querySelectorAll('[data-bank]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.bank)===mobileBank));
 $('bankSelect').value=mobileBank;
 const count=chosen.size;document.querySelector('[data-view="sequence"]').textContent=count?'steps ('+count+')':'steps';
}
const renderBeforeMobile=render,editorBeforeMobile=editor,stepsBeforeMobile=renderSteps;
render=()=>{renderBeforeMobile();syncMobile()};editor=()=>{editorBeforeMobile();syncMobile()};renderSteps=()=>{stepsBeforeMobile();syncMobile()};
function showView(view){if(recorder){say('Tap the recording pad again to finish first.');return}resetDelete();mobileView=view;document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!=='view-'+view);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));if(view==='play'){mobileBank=Math.floor(letters.indexOf(selected)/9);syncMobile()}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-bank]').forEach(b=>b.onclick=()=>{if(recorder){say('Finish recording first.');return}mobileBank=Number(b.dataset.bank);syncMobile()});
$('bankSelect').onchange=()=>{if(recorder){$('bankSelect').value=mobileBank;return}mobileBank=Number($('bankSelect').value);syncMobile()};
$('previous').onclick=()=>selectAdjacent(-1);$('next').onclick=()=>selectAdjacent(1);
$('audition').onclick=guard(()=>audition(selected));
// Edit one native field at a time, above the iOS keyboard; never scroll the instrument.
let editingInput=null;
for(const id of ['sampleName','start','end']){
 const input=$(id),button=document.createElement('button');button.type='button';button.className='value-button';button.dataset.label={bpm:'bpm',sampleName:'name',start:'start seconds',end:'end seconds',thresholdDb:'threshold dBFS'}[id];input.hidden=true;input.after(button);fields.set(input,button);
 button.onclick=()=>{editingInput=input;const field=$('fieldValue');field.type=input.type==='number'?'number':'text';for(const attr of ['min','max','step','maxlength']){if(input.hasAttribute(attr))field.setAttribute(attr,input.getAttribute(attr));else field.removeAttribute(attr)}field.inputMode=input.type==='number'?'decimal':'text';field.value=input.value;$('fieldTitle').textContent=button.dataset.label;$('fieldDialog').showModal();field.focus();field.select()};
}
$('fieldApply').onclick=e=>{e.preventDefault();const field=$('fieldValue');if(!field.reportValidity())return;if(editingInput){editingInput.value=field.value;editingInput.onchange?.()}$('fieldDialog').close();syncMobile()};
$('fieldDialog').addEventListener('close',()=>{editingInput=null;document.activeElement?.blur()});
const helpPages=[
 ['play','Tap pads with one or several fingers. Sound starts on touch-down. Three banks hold the same 26 letter samples as the desktop instrument. Load K / S / H drums in Setup to start.'],
 ['record','Tap an empty pad to start; tap again to finish. Or press and hold the empty pad, then release to finish. Capture starts on touch-down; a press lasting 350 ms or more counts as a hold. With threshold enabled it waits for sound first. Microphone permission is requested when you try to record. The mic is active only for capture; it is released when idle to preserve playback volume.'],
 ['threshold','In Setup, enable threshold and choose a dBFS value. −35 is a starting point; lower values are more sensitive. Tap an empty pad: it waits until sound crosses the threshold. Tap it again before sound arrives to cancel.'],
 ['steps','Up to 32 steps, in four pages of eight. Keyboard 1–8 addresses the current page; [ / ] changes pages. Select numbered steps, then return to Play and tap a sample. Tap again to remove it from those steps. Use “release steps” before playing freely. Space and keyboard shortcuts still work with a hardware keyboard.'],
 ['samples','Touch several pads together to keep them selected. FX applies to the selected recorded pads. Tap Delete, select any number of pads, then tap Delete again to remove it. Tap a marked pad to deselect; with no selection the button says Cancel Delete. Undo restores the entire deletion.'],
 ['keep your work','Projects save in this browser. Export backups in Setup. Use Safari’s Share menu → Add to Home Screen for a standalone launch. Keep the app visible while playing; switching apps stops transport and recording.'],
 ['touch','Pads suppress browser gestures while performing. Controls prevent double-tap zoom, and editors use full-size native fields. Deliberate pinch zoom remains available outside the pads. Rotate for a landscape layout.']
];let helpIndex=0;
function showHelp(){const [title,body]=helpPages[helpIndex];$('helpTitle').textContent=title;$('helpText').textContent=body;$('helpPage').textContent=(helpIndex+1)+' / '+helpPages.length;$('helpPrev').disabled=helpIndex===0;$('helpNext').disabled=helpIndex===helpPages.length-1;if(!$('help').open)$('help').showModal()}
$('helpToggle').onclick=showHelp;$('helpPrev').onclick=()=>{helpIndex--;showHelp()};$('helpNext').onclick=()=>{helpIndex++;showHelp()};$('helpClose').onclick=()=>$('help').close();
// Use the visible viewport only at normal scale; intentional pinch zoom stays native.
function fitViewport(){if(!window.visualViewport||window.visualViewport.scale!==1)return;document.documentElement.style.setProperty('--app-height',window.visualViewport.height+'px')}
window.visualViewport?.addEventListener('resize',fitViewport);window.addEventListener('resize',fitViewport);fitViewport();
document.addEventListener('contextmenu',e=>{if(e.target.closest('#keyboard,#record'))e.preventDefault()});
// Dismiss the software keyboard on Return; command shortcuts skip native dialogs.
document.addEventListener('keydown',e=>{if(!$('fieldDialog').open&&!$('help').open)return;e.stopImmediatePropagation();if(e.code==='Enter'&&$('fieldDialog').open){e.preventDefault();$('fieldApply').click()}if(e.code==='Escape'){$('fieldDialog').close();$('help').close()}},{capture:true});
syncMobile();

}
