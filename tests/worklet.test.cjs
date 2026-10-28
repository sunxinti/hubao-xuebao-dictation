const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'../src');

test('all shipped scripts parse, including worklets loaded only when recording starts',()=>{
  for(const file of fs.readdirSync(root).filter(name=>/\.(cjs|js)$/.test(name))) {
    execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
  }
});

test('actual recording processor registers and preserves PCM across audio render blocks',()=>{
  let Processor;const messages=[];
  class Base {
    constructor(){this.port={postMessage:(samples,transfers)=>{
      assert.equal(transfers[0],samples.buffer);
      messages.push(Array.from(samples));
    }};}
  }
  vm.runInNewContext(fs.readFileSync(path.join(root,'pcm-worklet.js'),'utf8'),{
    AudioWorkletProcessor:Base,Float32Array,
    registerProcessor:(name,implementation)=>{assert.equal(name,'blue-pcm');Processor=implementation;}
  });
  assert.equal(typeof Processor,'function');
  const recorder=new Processor();assert.equal(recorder.process([]),true);assert.equal(messages.length,0);
  const expected=[];
  for(let block=0;block<32;block++){
    const samples=Float32Array.from({length:128},(_,i)=>(block*128+i-2048)/4096);
    expected.push(...samples);assert.equal(recorder.process([[samples]]),true);
    assert.equal(messages.length,Math.floor((block+1)/16));
  }
  assert.deepEqual(messages.flat(),expected);
  recorder.process([[new Float32Array(128).fill(.75)]]);
  assert.deepEqual(messages.flat(),expected,'previous transferred chunks must stay unchanged');
});
