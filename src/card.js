'use strict';
const $=id=>document.getElementById(id);let current=null,displayed='';
function render(s){
 current=s;document.body.className=s.mode;
 $('status').textContent=({idle:'点一下，说给我听',loading:'准备麦克风…',recording:'我在听，你慢慢说',transcribing:'千问正在本机识别',done:'记下来了',armed:'等你叫「虎宝雪宝」',error:'需要处理一下'})[s.mode];
 if(s.mode==='done'&&!s.text)$('status').textContent='听写已结束';
 const ready=s.localModel?.phase==='ready';
 $('detail').textContent=ready?s.detail:s.localModel?.detail||'正在加载本地模型…';
 $('elapsed').textContent=s.mode==='recording'?`${Math.floor(s.seconds/60)}:${String(Math.floor(s.seconds%60)).padStart(2,'0')}`:'';
 if(displayed!==s.text){displayed=s.text;$('text').textContent=s.text;$('copied').textContent=s.settings.autoCopy?'已自动复制':'本机识别';}
 $('placeholder').hidden=Boolean(s.text);$('copy').disabled=!s.text.trim();
 $('error').hidden=!s.error;$('error').textContent=s.error;
 $('record').textContent=s.mode==='recording'?'结束听写':s.text?'再说一段':'开始听写';
 $('record').disabled=!ready||s.testRunning||['loading','transcribing'].includes(s.mode);
 $('cancel').hidden=!['loading','recording','transcribing'].includes(s.mode);
}
$('record').onclick=()=>window.blue.command('toggle');
$('cancel').onclick=()=>window.blue.command('cancel');
$('collapse').onclick=()=>window.blue.collapseCard();
$('settings').onclick=()=>window.blue.showPanel();
$('copy').onclick=async()=>{if(await window.blue.copy(current.text))$('copied').textContent='已复制';};
window.blue.onState(render);window.blue.state().then(render);
