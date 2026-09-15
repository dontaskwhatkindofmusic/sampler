const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('sampler.js','utf8');const code=js.split('const captureProcessor = `')[1].split('`;')[0];
let Processor;const scope={sampleRate:48000,Float32Array,Math,AudioWorkletProcessor:class{constructor(){this.messages=[];this.port={postMessage:m=>this.messages.push(m)}}},registerProcessor:(name,p)=>Processor=p};vm.runInNewContext(code,scope);
function setup(threshold=-35,limit=12){const p=new Processor();p.port.onmessage({data:{type:'configure',threshold,limit}});return p}
function feed(p,amplitude,blocks=1){for(let i=0;i<blocks;i++)p.process([[new Float32Array(128).fill(amplitude)]]);}
let p=setup();feed(p,0,100);assert.equal(p.messages.filter(x=>x.type==='started').length,0);assert.ok(p.historySize<1100);p.port.onmessage({data:{type:'stop'}});assert.equal(p.messages.at(-1).audio.length,0);
p=setup();feed(p,.001,100);feed(p,.1);assert.equal(p.messages.filter(x=>x.type==='started').length,1);feed(p,0,10);p.port.onmessage({data:{type:'stop'}});let complete=p.messages.at(-1);assert.ok(complete.audio.length>11*128);assert.ok(complete.audio.some(x=>Math.abs(x-.1)<1e-6));assert.equal(complete.audio.at(-1),0);p.finish();assert.equal(p.messages.filter(x=>x.type==='complete').length,1);
p=setup(-Infinity,.01);feed(p,0,10);assert.equal(p.messages.at(-1).audio.length,480);
p=setup(-20);feed(p,.02);assert.equal(p.capturing,false);feed(p,.2);assert.equal(p.capturing,true);
p=new Processor();feed(p,.9);assert.equal(p.messages.length,0);p.port.onmessage({data:{type:'stop'}});assert.equal(p.messages.at(-1).audio.length,0);
console.log('PASS: silence waits, cancellation has no audio, threshold starts once, bounded pre-roll preserves attack, quiet gaps continue, release completes once, duration cap, count-in cancellation.');
