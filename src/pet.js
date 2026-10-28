import {wakeMatches,encodeWav,VoiceGate} from './audio-core.js';
const api=window.blue;
let mode='idle',wakeEnabled=false,options={silenceSeconds:1.8},modelReady=false;
let stream=null,context=null,source=null,worklet=null,mute=null;
let chunks=[],gate=null,epoch=0,lastUpdate=0,lastWake=0,recordingRate=16000,wakeGate=null,wakeChunks=[],wakeBusy=false,wakeGeneration=0;
function publish(detail,error='',seconds=0,level=0){api.update({mode,wakeEnabled,detail,error,seconds,level});}
function fail(message){mode='error';publish(message,message);api.expandCard();}
function friendly(e){const t=String(e?.message||e||'');if(/denied|NotAllowed|Permission|权限/.test(t))return '麦克风未获授权，请到系统设置 → 隐私与安全性 → 麦克风中允许小狗';if(/NotFound|device/.test(t))return '没有可用麦克风，请检查系统声音输入设备';return t.replace(/^Error invoking remote method '[^']+': Error: /,'').slice(0,180)||'暂时无法录音';}
async function ensureAudio(token){
 if(context&&stream)return;
 if(!await api.microphone())throw Error('麦克风权限未获授权');
 if(token!==epoch)return;
 const nextStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
 if(token!==epoch){nextStream.getTracks().forEach(t=>t.stop());return;}
 stream=nextStream;
 try{
  context=new AudioContext({sampleRate:16000});await context.audioWorklet.addModule('pcm-worklet.js');
  if(token!==epoch){closeAudio();return;}
  recordingRate=context.sampleRate;source=context.createMediaStreamSource(stream);worklet=new AudioWorkletNode(context,'blue-pcm');mute=context.createGain();mute.gain.value=0;
  worklet.port.onmessage=e=>onPCM(e.data);source.connect(worklet);worklet.connect(mute);mute.connect(context.destination);await context.resume();
  stream.getAudioTracks()[0].onended=()=>{if(stream){cancelAll('麦克风已断开，点击可重新连接');}};
 }catch(e){closeAudio();throw e;}
}
function closeAudio(){
 if(worklet){worklet.port.onmessage=null;worklet.disconnect();worklet=null;}source?.disconnect();source=null;mute?.disconnect();mute=null;
 if(stream){const previous=stream;stream=null;previous.getTracks().forEach(t=>{t.onended=null;t.stop();});}
 if(context){const c=context;context=null;c.close().catch(()=>{});}
}
function resetWake(){wakeGeneration++;wakeGate=new VoiceGate(recordingRate,.65);wakeChunks=[];wakeBusy=false;}
function removeRecognizer(){wakeGeneration++;wakeGate=null;wakeChunks=[];wakeBusy=false;}
async function scanWake(audio,generation){
 try{
  const result=await api.wakeTranscribe(encodeWav(audio,recordingRate));
  if(generation!==wakeGeneration||mode!=='armed'||!wakeEnabled)return;
  if(wakeMatches(result.text)&&performance.now()-lastWake>1500){lastWake=performance.now();beginRecording(true);return;}
 }catch(error){
  if(generation===wakeGeneration&&wakeEnabled){await cancelAll();fail(friendly(error));return;}
 }finally{if(generation===wakeGeneration){wakeBusy=false;wakeGate=new VoiceGate(recordingRate,.65);wakeChunks=[];}}
}
function onPCM(pcm){
 if(mode==='armed'&&wakeEnabled){
  if(wakeBusy||!wakeGate)return;
  wakeChunks.push(pcm.slice());const result=wakeGate.push(pcm);
  if(result.voiced===0){wakeChunks=wakeChunks.slice(-3);wakeGate=new VoiceGate(recordingRate,.65);return;}
  if(result.stop||result.empty||result.seconds>=5){
   const audio=wakeChunks;wakeChunks=[];wakeGate=new VoiceGate(recordingRate,.65);
   if(result.voiced>=.25){wakeBusy=true;scanWake(audio,wakeGeneration);}
  }
  return;
 }
 if(mode!=='recording'||!gate)return;
 chunks.push(pcm.slice());const s=gate.push(pcm);
 if(performance.now()-lastUpdate>230){lastUpdate=performance.now();publish('停顿后自动转写，也可以再点一次结束','',s.seconds,s.level);}
 if(s.empty){finish(false,'没有听到说话，已取消');return;}
 if(s.stop)finish(true);
}
async function beginRecording(fromWake=false){
 api.expandCard(true);
 if(['recording','transcribing','loading'].includes(mode))return;
 if(!modelReady){fail('本地千问模型尚未就绪，请查看设置');return;}
 const token=++epoch;mode='loading';publish('准备麦克风…');removeRecognizer();
 try{
  await ensureAudio(token);if(token!==epoch)return;
  // Wake audio itself is excluded: users can start speaking when the pet turns pink.
  chunks=[];gate=new VoiceGate(recordingRate,options.silenceSeconds);
  mode='recording';publish(fromWake?'我在听，请说吧':'开始说话吧');
 }catch(e){if(token!==epoch)return;wakeEnabled=false;closeAudio();fail(friendly(e));}
}
async function afterRecording(detail){
 if(wakeEnabled){mode='armed';resetWake();publish(detail||'正在等你叫「虎宝雪宝」');}
 else{closeAudio();mode='done';publish(detail||'已经记下来了');}
}
async function finish(send=true,detail=''){
 if(mode!=='recording')return;
 const token=++epoch;const audio=chunks;chunks=[];const voiced=gate?.voiced||0;gate=null;mode='transcribing';
 if(!send||voiced<.20){await afterRecording(detail||'录音太短，请再试一次');return;}
 publish('千问正在本机识别…');if(!wakeEnabled)closeAudio();
 try{
  const result=await api.transcribe(encodeWav(audio,recordingRate));
  if(token!==epoch)return;await afterRecording(result.truncated?'文字可能不完整，请分段重新听写':result.copied?'已复制，直接粘贴就好':'文字已准备好');
 }catch(e){if(token!==epoch)return;wakeEnabled=false;removeRecognizer();closeAudio();fail(friendly(e));}
}
async function toggleWake(){
 if(wakeEnabled||mode==='loading'){await cancelAll('语音唤醒已暂停');return;}
 if(mode==='recording'||mode==='transcribing')return;
 if(!modelReady){fail('本地千问模型尚未就绪，请查看设置');return;}
 const token=++epoch;mode='loading';publish('准备本地千问唤醒…');
 try{await ensureAudio(token);if(token!==epoch)return;wakeEnabled=true;mode='armed';resetWake();publish('正在等你叫「虎宝雪宝」');}
 catch(e){if(token!==epoch)return;wakeEnabled=false;removeRecognizer();closeAudio();fail(friendly(e));}
}
async function cancelAll(detail='已取消，录音已清空'){
 ++epoch;wakeEnabled=false;chunks=[];gate=null;removeRecognizer();closeAudio();await api.cancelRequest();mode='idle';publish(detail);
}
async function command(value){
 if(value==='suspend')return cancelAll('已暂停，点击可重新开始');
 if(value==='cancel')return cancelAll();
 if(value==='wake')return toggleWake();
 if(value==='toggle'){if(mode==='recording')return finish();if(mode==='transcribing')return;return beginRecording();}
}
api.onCommand(command);
function render(s){
 document.getElementById('pet-content').style.transform=`scale(${s.settings.petScale||1})`;
 modelReady=s.localModel?.phase==='ready'&&!s.testRunning;options=s.settings;document.body.className=s.mode+(['recording','loading','transcribing','error'].includes(s.mode)?' active':'');
 document.getElementById('tip').textContent=({recording:'我在听…',transcribing:'正在转成文字',armed:'叫我「虎宝雪宝」',done:'已记下来啦',loading:'准备中…',error:'点下面 ··· 查看'})[s.mode]||'点击我，开始听写';
}
api.onState(render);api.state().then(render);
document.getElementById('open').onclick=()=>api.expandCard();
const robot=document.getElementById('robot');let pointer=null;
robot.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.screenX,y:e.screenY,dx:e.clientX,dy:e.clientY,moved:false};robot.setPointerCapture(e.pointerId);});
robot.addEventListener('pointermove',e=>{if(!pointer)return;if(Math.hypot(e.screenX-pointer.x,e.screenY-pointer.y)>5)pointer.moved=true;if(pointer.moved)api.drag({x:e.screenX-pointer.dx,y:e.screenY-pointer.dy});});
robot.addEventListener('pointerup',e=>{if(e.button!==0)return;if(pointer&&!pointer.moved)command('toggle');pointer=null;});
document.addEventListener('contextmenu',e=>{e.preventDefault();pointer=null;api.petMenu();});
robot.addEventListener('pointercancel',()=>pointer=null);
robot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();command('toggle');}});
window.addEventListener('beforeunload',()=>{removeRecognizer();closeAudio();});

// Exercise the real worklet without opening the microphone or playing sound.
window.blueAudioSelfTest=async base64=>{
 const bytes=Uint8Array.from(atob(base64),value=>value.charCodeAt(0));
 const decoder=new OfflineAudioContext(1,1,16000);
 const decoded=await decoder.decodeAudioData(bytes.buffer);
 const frameCount=Math.ceil(decoded.length/2048)*2048;
 const offline=new OfflineAudioContext(1,frameCount,16000);
 await offline.audioWorklet.addModule(new URL('pcm-worklet.js',import.meta.url).href);
 const node=new AudioWorkletNode(offline,'blue-pcm');
 const padded=offline.createBuffer(1,frameCount,16000);
 padded.copyToChannel(decoded.getChannelData(0),0);
 const input=offline.createBufferSource();input.buffer=padded;
 const received=[];let timer;
 const complete=new Promise((resolve,reject)=>{
  timer=setTimeout(()=>reject(Error('录音组件测试超时')),10000);
  node.onprocessorerror=()=>reject(Error('录音组件运行失败'));
  node.port.onmessage=event=>{
   received.push(event.data);
   if(received.length*2048===frameCount)resolve();
  };
 });
 input.connect(node);node.connect(offline.destination);input.start();
 // Attach rejection handlers before rendering, including processor failures.
 const work=Promise.all([complete,offline.startRendering()]);
 try{
  await work;
  const wav=new Uint8Array(encodeWav(received,16000));let binary='';
  for(let offset=0;offset<wav.length;offset+=16384)binary+=String.fromCharCode(...wav.subarray(offset,offset+16384));
  return {wav:btoa(binary),frames:frameCount};
 }finally{clearTimeout(timer);node.port.onmessage=null;node.disconnect();input.disconnect();}
};
