const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validateAudio,responseText,MODEL} = require('../src/core.cjs');
const load = () => import('../src/audio-core.js');
test('WAV records real PCM bytes for the local Qwen model',async()=>{
 const {encodeWav}=await load();const wav=encodeWav([new Float32Array([0,1,-1,.5])],16000);
 const b=validateAudio(wav);assert.equal(b.length,52);assert.equal(b.readInt16LE(46),32767);assert.equal(b.readInt16LE(48),-32768);
 assert.equal(MODEL,'Qwen3-ASR-0.6B');assert.equal(b.readUInt32LE(40),8);assert.equal(b.readUInt32LE(24),16000);
});
test('reject malformed, truncated and oversized recordings before inference',async()=>{
 const {encodeWav}=await load();assert.throws(()=>validateAudio(Buffer.from('not audio')));
 let b=Buffer.from(encodeWav([new Float32Array(16000)],16000));b.writeUInt32LE(64000,40);assert.throws(()=>validateAudio(b));
 b=Buffer.from(encodeWav([new Float32Array(16000*122)],16000));assert.throws(()=>validateAudio(b));
});
test('wake phrase handles both dogs, punctuation and traditional characters without matching unrelated speech',async()=>{
 const {wakeMatches}=await load();
 for(const text of ['虎 宝 雪 宝','虎宝，虎宝！','雪寶雪寶','你好虎宝。','你好雪宝'])assert.equal(wakeMatches(text),true,text);
 for(const text of ['虎宝','雪宝','雪宝宝','虎宝雪宝今天出门了','请给我写一个程序','小蓝小蓝'])assert.equal(wakeMatches(text),false,text);
});
test('silence before speech never triggers submission; a pause after speech finishes',async()=>{
 const {VoiceGate}=await load();let v=new VoiceGate(16000,1.8);const quiet=new Float32Array(1600),voice=new Float32Array(1600).fill(.05);
 for(let i=0;i<75;i++)assert.equal(v.push(quiet).stop,false);assert.equal(v.push(quiet).empty,false);
 for(let i=0;i<5;i++)v.push(voice);for(let i=0;i<17;i++)assert.equal(v.push(quiet).stop,false);assert.equal(v.push(quiet).stop,true);
});
test('eight seconds of silence ends without transcription',async()=>{
 const {VoiceGate}=await load();const v=new VoiceGate(16000);let r;for(let i=0;i<81;i++)r=v.push(new Float32Array(1600));assert.equal(r.empty,true);assert.equal(r.voiced,0);
});
test('keep transcript verbatim and reject invalid model output',()=>{
 assert.equal(responseText({text:'  一个测试。\n第二行。  '}),'一个测试。\n第二行。');assert.throws(()=>responseText({text:''}));assert.throws(()=>responseText({choices:[]}));
});
