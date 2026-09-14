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
function showView(view){releaseRecord();mobileView=view;document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!=='view-'+view);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));if(view==='play'){mobileBank=Math.floor(letters.indexOf(selected)/9);syncMobile()}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-bank]').forEach(b=>b.onclick=()=>{releaseRecord();mobileBank=Number(b.dataset.bank);syncMobile()});
$('bankSelect').onchange=()=>{releaseRecord();mobileBank=Number($('bankSelect').value);syncMobile()};
$('previous').onclick=()=>selectAdjacent(-1);$('next').onclick=()=>selectAdjacent(1);
$('audition').onclick=guard(async()=>{await audio();if(buffers[selected])trigger(selected);else say('This pad is empty. Import audio from Files, or record it in Play.')});
// Edit one native field at a time, above the iOS keyboard; never scroll the instrument.
let editingInput=null;
for(const id of ['bpm','sampleName','start','end','thresholdDb']){
 const input=$(id),button=document.createElement('button');button.type='button';button.className='value-button';button.dataset.label={bpm:'bpm',sampleName:'name',start:'start seconds',end:'end seconds',thresholdDb:'threshold dBFS'}[id];input.hidden=true;input.after(button);fields.set(input,button);
 button.onclick=()=>{editingInput=input;const field=$('fieldValue');field.type=input.type==='number'?'number':'text';for(const attr of ['min','max','step','maxlength']){if(input.hasAttribute(attr))field.setAttribute(attr,input.getAttribute(attr));else field.removeAttribute(attr)}field.inputMode=input.type==='number'?'decimal':'text';field.value=input.value;$('fieldTitle').textContent=button.dataset.label;$('fieldDialog').showModal();field.focus();field.select()};
}
$('fieldApply').onclick=e=>{e.preventDefault();const field=$('fieldValue');if(!field.reportValidity())return;if(editingInput){editingInput.value=field.value;editingInput.onchange?.()}$('fieldDialog').close();syncMobile()};
$('fieldDialog').addEventListener('close',()=>{editingInput=null;document.activeElement?.blur()});
$('micCheck').onclick=guard(async()=>{if(recorder||importing)return;$('micCheck').disabled=true;try{await audio();const input=await navigator.mediaDevices.getUserMedia({audio:true});input.getTracks().forEach(t=>t.stop());say('Microphone allowed. Hold an empty pad for 2 seconds, then keep holding to record.')}finally{$('micCheck').disabled=false}});
const helpPages=[
 ['play','Tap pads with one or several fingers. Sound starts on touch-down. Three banks hold the same 26 letter samples as the desktop instrument. Load K / S / H drums in Setup to start.'],
 ['record','Hold an empty pad for 2 seconds, then keep holding to record. A quick tap only shows a hint. Release to stop. For a loaded pad, use Record + pad to deliberately replace it. Check microphone permission in Setup first.'],
 ['threshold','In Setup, enable threshold and choose a dBFS value. −35 is a starting point; lower values are more sensitive. Hold an empty pad for 2 seconds: it waits until sound crosses the threshold. Release before sound arrives to cancel without saving.'],
 ['steps','Select numbered steps, then return to Play and tap a sample. Tap again to remove it from those steps. Use “release steps” before playing freely. Space and keyboard shortcuts still work with a hardware keyboard.'],
 ['samples','Tap a pad to select it, then open Sample to import from Files, change its level, reverse, trim, or delete it. Use the arrows to select without playing. Recordings and imports are limited to 12 seconds.'],
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
