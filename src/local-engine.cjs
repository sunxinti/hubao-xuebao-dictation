'use strict';
const {spawn} = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const {validateAudio, responseText} = require('./core.cjs');

// Pipes only: no listening port, credentials, HTTP client or cloud fallback.
class LocalEngine {
  constructor(root, onStatus = () => {}) {
    this.root = root;this.onStatus = onStatus;this.child = null;this.loading = null;this.pending = null;this.serial = 0;this.ready = false;
  }
  async start() {
    if (this.ready) return;
    if (this.loading) return this.loading;
    const child = spawn(path.join(this.root, 'python/bin/python3'), ['-I','-B','-u',path.join(this.root,'bridge.py')], {
      cwd: this.root, windowsHide: true, stdio: ['pipe','pipe','ignore'],
      env: {HOME: os.homedir(), PATH:'/usr/bin:/bin', LANG:'en_US.UTF-8', TMPDIR:os.tmpdir(),
        HF_HUB_OFFLINE:'1', HF_HUB_DISABLE_TELEMETRY:'1', TRANSFORMERS_OFFLINE:'1', DO_NOT_TRACK:'1'}
    });
    this.child = child;child.stdout.setEncoding('utf8');this.onStatus({phase:'loading', detail:'正在加载本机千问模型…'});
    let buffer = '', settled = false;
    const loading = new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(Error('本地模型加载超时，请重启小狗')), 90000);
      const finish = error => {
        if (settled) return;settled = true;clearTimeout(timer);
        if(this.abortStart===finish)this.abortStart=null;
        if (error) {if(this.child===child){this.child=null;this.ready=false;}child.kill();reject(error);}
        else resolve();
      };
      this.abortStart=finish;
      child.on('error', () => finish(Error('本地语音组件无法启动，请检查应用包是否完整')));
      child.stdin.on('error', () => {});
      child.on('exit', () => {
        if (this.child !== child) return;
        this.ready=false;this.child=null;this.loading=null;
        const error=Error('本地语音组件已停止，请点击“重新加载模型”');
        if(!settled)finish(error);
        if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}
        this.onStatus({phase:'error',detail:error.message});
      });
      child.stdout.on('data', chunk => {
        if (this.child !== child) return;
        buffer += chunk.toString('utf8');
        if (buffer.length > 1024*1024) {finish(Error('本地组件返回异常'));child.kill();return;}
        let newline;
        while ((newline=buffer.indexOf('\n'))>=0) {
          const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);let value;
          try {value=JSON.parse(line);} catch {continue;}
          if(value.type==='ready'){
            this.ready=true;this.onStatus({phase:'ready',detail:'千问已就绪 · 全程在本机识别',device:value.device});finish();
          } else if(value.type==='fatal') {
            const message = value.code==='NO_METAL'?'本机 GPU 暂不可用，请退出后重新打开小狗':'本地模型加载失败，请检查应用包是否完整';
            finish(Error(message));this.onStatus({phase:'error',detail:message});
          } else if(this.pending && value.id===this.pending.id) {
            const p=this.pending;this.pending=null;clearTimeout(p.timer);
            if(value.error)p.reject(Error('本地识别失败，请缩短录音后重试'));
            else {
              try{p.resolve({text:responseText(value),seconds:value.seconds,truncated:Boolean(value.truncated)});}catch(error){p.reject(error);}
            }
          }
        }
      });
    });
    this.loading = loading;
    try {await loading;} finally {if(this.loading===loading)this.loading=null;}
  }
  async transcribe(bytes) {
    const wav=validateAudio(bytes);await this.start();
    if(this.pending)throw Error('上一段正在本机识别');
    return new Promise((resolve,reject)=>{
      const id=++this.serial;
      const timer=setTimeout(()=>this.stop('本地识别超时，请缩短录音后重试'),180000);
      this.pending={id,resolve,reject,timer};
      this.child.stdin.write(JSON.stringify({id,audio:wav.toString('base64')})+'\n',error=>{if(error)this.stop('本地语音组件连接中断');});
    });
  }
  cancel() {if(this.pending)this.stop('已取消本地识别');}
  stop(message='本地模型已停止') {
    const child=this.child;this.child=null;this.ready=false;this.loading=null;
    this.abortStart?.(Error(message));this.abortStart=null;
    if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(message));this.pending=null;}
    child?.stdin.end();child?.kill();this.onStatus({phase:'stopped',detail:message});
  }
}
module.exports = {LocalEngine};
