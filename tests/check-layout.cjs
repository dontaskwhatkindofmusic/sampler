const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('layout.js','utf8');
for(const [matches,search,wanted] of [[true,'',true],[false,'',false],[true,'?desktop=1',false],[false,'?touch=1',true]]){
 let mounted;const nodes={bpm:{add(){}},desktopStyle:{},touchStyle:{},desktopLayout:{content:{cloneNode:()=>({mode:'desktop'})}},touchLayout:{content:{cloneNode:()=>({mode:'touch'})}}};const document={documentElement:{dataset:{}},getElementById:id=>nodes[id],body:{insertBefore:node=>mounted=node}};
 vm.runInNewContext(source,{document,Option:class{},matchMedia:()=>({matches}),URLSearchParams,location:{search}});
 assert.equal(mounted.mode,wanted?'touch':'desktop');assert.equal(nodes.desktopStyle.disabled,wanted);assert.equal(nodes.touchStyle.disabled,!wanted);assert.equal(document.documentElement.dataset.mobile,String(wanted));
}
vm.runInNewContext(fs.readFileSync('mobile.js','utf8'),{mobileUI:false});
console.log('PASS: automatic layout choice, manual overrides, stylesheet selection, desktop isolation.');
