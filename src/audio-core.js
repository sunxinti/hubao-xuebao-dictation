export const MAX_SECONDS = 120;
export function wakeMatches(text) {
 const clean = String(text || '').normalize('NFKC').replace(/[\s，。！？,.!?、：:；;「」“”"']/g,'').replace(/寶/g,'宝');
 return ['虎宝雪宝','虎宝虎宝','雪宝雪宝','你好虎宝','你好雪宝'].some(phrase=>clean.endsWith(phrase));
}
export function rms(samples) {let sum=0;for(const v of samples)sum+=v*v;return Math.sqrt(sum/Math.max(1,samples.length));}
export function encodeWav(chunks, sampleRate) {
 const samples=chunks.reduce((n,a)=>n+a.length,0), buffer=new ArrayBuffer(44+samples*2),v=new DataView(buffer);
 const str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
 str(0,'RIFF');v.setUint32(4,36+samples*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);
 v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples*2,true);
 let n=44;for(const c of chunks)for(const value of c){const s=Math.max(-1,Math.min(1,value));v.setInt16(n,s<0?s*32768:s*32767,true);n+=2;}return buffer;
}
export class VoiceGate {
 constructor(rate,silence=1.8){this.rate=rate;this.silence=silence;this.samples=0;this.voiced=0;this.lastVoice=0;this.noise=0.002;}
 push(data){
  const power=rms(data);this.samples+=data.length;const now=this.samples/this.rate;
  const speaking=power>Math.max(0.009,this.noise*3.0);
  if(speaking){this.voiced+=data.length/this.rate;this.lastVoice=now;}else if(this.voiced===0)this.noise=this.noise*.95+power*.05;
  return {seconds:now,level:Math.min(1,power*9),voiced:this.voiced,
   stop:now>=MAX_SECONDS||(this.voiced>.25&&now-this.lastVoice>=this.silence),empty:now>=8&&this.voiced<.25};
 }
}
