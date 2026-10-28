'use strict';
const $ = id => document.getElementById(id);
let current, lastText = '';
function tab(name) {for (const n of ['dictation','settings']) {$(n).hidden = n !== name;$(n+'-tab').classList.toggle('selected', n === name);}}
$('dictation-tab').onclick = () => tab('dictation');$('settings-tab').onclick = () => tab('settings');
function render(s) {
 current = s;
 if (s.text !== lastText) {$('transcript').value = s.text;lastText = s.text;updateCount();$('copy-status').textContent = s.settings.autoCopy ? '已自动复制，可以直接粘贴' : '原意保留，不自动润色';}
 const labels = {idle:'待命中',loading:'准备中',armed:'等你呼唤',recording:'正在听',transcribing:'转写中',done:'已记下来',error:'需要处理'};
 $('status-label').textContent = labels[s.mode];$('status-dot').style.background = s.mode==='recording'?'#e78a80':s.wakeEnabled?'#52ae94':'#94a9d5';
 $('detail').textContent = s.detail;$('error').hidden = !s.error;$('error').textContent = s.error;
 $('record-title').textContent = s.mode==='recording'?'说吧，我在听…':s.mode==='transcribing'?'正在整理成文字…':'开始听写';
 $('record').classList.toggle('active', s.mode==='recording');$('record').disabled = Boolean(s.testRunning)||['loading','transcribing'].includes(s.mode);
 $('cancel').hidden = !['recording','transcribing'].includes(s.mode);
 $('elapsed').textContent = s.mode==='recording'?`${Math.floor(s.seconds/60)}:${String(Math.floor(s.seconds%60)).padStart(2,'0')}`:'';
 $('wake').classList.toggle('on',s.wakeEnabled);$('wake').setAttribute('aria-checked',String(s.wakeEnabled));
 $('wake').disabled=Boolean(s.testRunning);
 $('wake-hint').textContent = s.wakeEnabled?'只在本机识别唤醒词，点右侧可暂停':'开启后，在本机等待你的呼唤';
 const local=s.localModel||{phase:'loading',detail:'正在准备模型…'};
 $('model-status').textContent=({ready:'已就绪 · 完全离线',loading:'正在加载本地模型…',error:'需要处理',stopped:'模型已暂停'})[local.phase]||'正在准备';
 $('model-detail').textContent=local.detail;
 $('reload-model').disabled=local.phase==='loading'||local.phase==='ready'||s.mode==='transcribing';
 $('test-model').disabled=s.wakeEnabled||Boolean(s.testRunning)||local.phase!=='ready'||['recording','transcribing','loading'].includes(s.mode);
 $('show-card').checked=s.settings.showCardOnRecord;$('pet-scale').value=String(s.settings.petScale);
 $('auto-copy').checked = s.settings.autoCopy;$('silence').value = String(s.settings.silenceSeconds);
}
function updateCount() {$('count').textContent = `${$('transcript').value.length} 字`;$('copy').disabled = !$('transcript').value.trim();}
$('transcript').oninput = updateCount;
$('copy').onclick = async () => {if (await window.blue.copy($('transcript').value)) {$('copy-status').textContent='已复制到剪贴板';}};
$('record').onclick = () => {if(current?.localModel?.phase!=='ready'){tab('settings');return;}window.blue.command('toggle');};
$('cancel').onclick = () => window.blue.command('cancel');
$('wake').onclick = () => {if(current?.localModel?.phase!=='ready'){tab('settings');return;}window.blue.command('wake');};
$('reload-model').onclick=async()=>{try{await window.blue.reloadModel();}catch(e){$('model-test').textContent='加载失败，请重新打开小狗。';}};
$('test-model').onclick=async()=>{
 $('test-model').disabled=true;$('model-test').textContent='正在检查本地模型…';
 try{const r=await window.blue.testModel();$('model-test').textContent=r.ready?`${r.model} 已加载。实际识别请点击小狗试说。`:'本地模型未就绪';}
 catch(e){$('model-test').textContent=String(e.message).replace(/^Error invoking remote method '[^']+': Error: /,'');}
 finally{$('test-model').disabled=false;}
};
async function preferences() {await window.blue.settings({autoCopy:$('auto-copy').checked,silenceSeconds:Number($('silence').value),showCardOnRecord:$('show-card').checked,petScale:Number($('pet-scale').value)});}
$('auto-copy').onchange=preferences;$('silence').onchange=preferences;$('show-card').onchange=preferences;$('pet-scale').onchange=preferences;
document.addEventListener('keydown',e=>{if(e.metaKey&&e.key.toLowerCase()==='c'&&document.activeElement!==$('transcript')&&$('transcript').value.trim()){e.preventDefault();$('copy').click();}});
window.blue.onState(render);window.blue.state().then(render);
window.blue.onPanelTab(name=>{if(['dictation','settings'].includes(name))tab(name);});
