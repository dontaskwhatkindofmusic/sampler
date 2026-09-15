'use strict';
// The coach observes real instrument state; it never creates or replaces samples.
let tutorialStep=-1,tutorialKey=null,tutorialOriginal=null;
const tutorialSeenKey='letter-sampler-tutorial-seen-v1';
const tutorialStages=[
 {title:'record a sound',view:'play',targets:()=>['pad'+tutorialKey],text:()=>tutorialOriginal?'All pads are filled. Tap '+tutorialKey+' to hear it. Next, we’ll use it in a loop.':'Tap '+tutorialKey+', allow the microphone, make a sound, then tap '+tutorialKey+' to finish. You can also hold and release. Threshold waits for sound if enabled.',done:()=>tutorialOriginal?true:!!p.samples[tutorialKey]&&p.samples[tutorialKey].blob!==tutorialOriginal&&!recorder},
 {title:'turn on click + write live',view:'setup',targets:()=>['metro','overdub'],text:()=> 'Enable Click and Write Live. Click keeps time; Write Live places your pad hits into the sequence.',done:()=>$('metro').checked&&$('overdub').checked},
 {title:'play your loop',view:'play',targets:()=>['play','pad'+tutorialKey],text:()=> 'Press Play, then tap '+tutorialKey+' in time with the click. Your hits repeat around the loop. Keep playing until it feels good.',done:()=>playing&&p.pattern.some(row=>row.includes(tutorialKey))},
 {title:'listen without adding notes',view:'setup',targets:()=>['overdub','metro'],text:()=> 'Turn Write Live off to stop adding notes. Leave playback running and listen. You can turn Click off too.',done:()=>!$('overdub').checked&&playing},
 {title:'edit steps',view:'sequence',targets:()=>['steps','stepPage','length'],text:()=> 'Choose up to 32 steps in four pages. Select steps, return to Play, and tap a pad to add or remove it. Release Steps before free playing.',done:()=>true},
 {title:'shape your sound',view:'sample',targets:()=>['fxOpen','gain'],text:()=> 'Sample FX has pitch/speed, filter, pan and compression. Level changes sample gain. Master FX controls the whole mix (in Setup on phones).',done:()=>true},
 {title:'keep your loop',view:'setup',targets:()=>['export'],text:()=> 'Export Project to keep a backup. Browser storage belongs to this device and site. Help can restart this tutorial anytime. Stop or Esc ends playback and recording.',done:()=>true}
];
function tutorialView(view){if(mobileUI)document.querySelector('[data-view="'+view+'"]').click()}
function tutorialPaint(){
 if(tutorialStep<0)return;
 const step=tutorialStages[tutorialStep];
 $('tutorialTitle').textContent=(tutorialStep+1)+' / '+tutorialStages.length+' · '+step.title;
 $('tutorialText').textContent=step.text();$('tutorialBack').disabled=tutorialStep===0;
 $('tutorialNext').textContent=tutorialStep===tutorialStages.length-1?'done':'next';
 $('tutorialNext').disabled=!step.done()||!!recorder;
 document.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'));
 for(const id of step.targets())$(id)?.classList.add('tutorial-target');
}
function tutorialGo(n){tutorialStep=n;selected=tutorialKey;multiSelected.clear();multiSelected.add(tutorialKey);render();tutorialView(tutorialStages[n].view);tutorialPaint()}
function endTutorial(){tutorialStep=-1;$('tutorialPanel').hidden=true;document.body.classList.remove('tutorial-active');document.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'))}
function startTutorial(){
 if(!ready){say('Wait for saved samples to load, then start the tutorial from Help.');return}
 if(recorder||importing){say('Finish recording or importing before starting the tutorial.');return}
 $('tutorialWelcome').close();if(mobileUI)$('help').close();else $('help').open=false;
 $('panic').click();chosen.clear();tutorialKey=[...letters].find(k=>!p.samples[k])||selected;tutorialOriginal=p.samples[tutorialKey]?.blob||null;
 $('tutorialPanel').hidden=false;document.body.classList.add('tutorial-active');tutorialGo(0);
}
$('tutorialStart').onclick=startTutorial;$('tutorialRestart').onclick=startTutorial;
$('tutorialSkip').onclick=()=>$('tutorialWelcome').close();$('tutorialExit').onclick=endTutorial;
$('tutorialBack').onclick=()=>{if(tutorialStep>0&&!recorder)tutorialGo(tutorialStep-1)};
$('tutorialNext').onclick=()=>{if(tutorialStep<0||recorder||!tutorialStages[tutorialStep].done())return;if(tutorialStep===tutorialStages.length-1)endTutorial();else tutorialGo(tutorialStep+1)};
let tutorialOfferChecked=false;
setInterval(()=>{
 if(!tutorialOfferChecked&&ready&&!recorder&&!importing&&!document.querySelector('dialog[open]')){tutorialOfferChecked=true;let seen=false;try{seen=localStorage.getItem(tutorialSeenKey)==='1';localStorage.setItem(tutorialSeenKey,'1')}catch{/* Storage restrictions cannot prevent using the instrument. */}if(!seen&&!recorder&&!importing)$('tutorialWelcome').showModal()}
 if(tutorialStep>=0){$('tutorialNext').disabled=!tutorialStages[tutorialStep].done()||!!recorder;$('tutorialBack').disabled=tutorialStep===0||!!recorder}
},300);
