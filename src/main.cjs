'use strict';
const {app, BrowserWindow, ipcMain, protocol, net, Menu, Tray, nativeImage, globalShortcut, clipboard, systemPreferences, screen, powerMonitor} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {MODEL} = require('./core.cjs');
const {LocalEngine} = require('./local-engine.cjs');
const {PET,CARD,petSize,petPosition,cardBounds} = require('./overlay-layout.cjs');
const DEV_TEST = process.argv.includes('--smoke-test');
if (DEV_TEST) app.setPath('userData', path.join(app.getPath('temp'), 'hubao-xuebao-smoke'));
app.setName('虎宝雪宝听写');
app.commandLine.appendSwitch('disable-background-networking');
protocol.registerSchemesAsPrivileged([{scheme: 'hubaoxuebao', privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true}}]);
const ORIGIN = 'hubaoxuebao://app';
const ASSET_ROOT = path.resolve(__dirname);
let pet, panel, card, tray, quitting = false, pending = null, engine, cardDismissed=false;
let settings = {autoCopy: true, silenceSeconds: 1.8, wakePhrase: '虎宝雪宝',showCardOnRecord:true,petScale:1};
let state = {mode: 'idle', wakeEnabled: false, text: '', error: '', detail: '点击小狗，开始听写', seconds: 0, level: 0, model: MODEL, localModel: {phase:'loading',detail:'正在加载本机千问模型…'}};
function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function snapshot() {return {...state, settings};}
function broadcast() {
  for (const w of [pet, panel, card]) if (w && !w.isDestroyed()) w.webContents.send('state-changed', snapshot());
  updateTray();
}
function trusted(event) {
  const f = event.senderFrame;
  if (!f || f !== event.sender.mainFrame || ![pet?.webContents, panel?.webContents, card?.webContents].includes(event.sender) || !f.url.startsWith(ORIGIN + '/')) throw Error('未授权的请求');
}
function fromPet(event) {trusted(event); if (event.sender !== pet.webContents) throw Error('仅录音窗口可执行此操作');}
function privateDir() {fs.mkdirSync(app.getPath('userData'), {recursive: true, mode: 0o700});}
function positionCard() {
  if (!pet || !card || pet.isDestroyed() || card.isDestroyed()) return;
  const bounds=pet.getBounds();card.setBounds(cardBounds(bounds,screen.getDisplayMatching(bounds).workArea));
}
function showCard() {if (card && !card.isDestroyed()) {positionCard();card.showInactive();}}
function showPanel() {
  if (!panel || !pet) return;
  const area=screen.getDisplayMatching(pet.getBounds()).workArea, b=panel.getBounds();
  panel.setPosition(Math.round(area.x+(area.width-b.width)/2),Math.round(area.y+(area.height-b.height)/2));
  panel.webContents.send('panel-tab','settings');panel.showInactive();
}
function sendCommand(command) {pet?.webContents.send('engine-command', command);}
function savePreferences(patch) {
  settings={...settings,...patch};
  fs.writeFileSync(settingsPath(),JSON.stringify(settings),{mode:0o600});
  if(!settings.showCardOnRecord)card?.hide();
  if(pet && patch.petScale!==undefined){
    const b=pet.getBounds(),size=petSize(settings.petScale),area=screen.getDisplayMatching(b).workArea;
    const pos=petPosition({x:b.x,y:b.y+b.height-size.height},area,settings.petScale);
    pet.setBounds({...pos,...size});positionCard();
  }
  broadcast();return true;
}
function appearanceMenu(){return [
  {label:'听写时显示文字框',type:'checkbox',checked:settings.showCardOnRecord,click:item=>savePreferences({showCardOnRecord:item.checked})},
  {label:'宠物大小',submenu:[['小 · 70%',.7],['中 · 100%',1],['大 · 125%',1.25]].map(([label,scale])=>({label,type:'radio',checked:settings.petScale===scale,click:()=>savePreferences({petScale:scale})}))}
];}
function updateTray() {
  if (!tray) return;
  tray.setToolTip(`虎宝雪宝听写 · ${state.detail}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label: '展开听写卡片', click: showCard},
    {label: '设置与详细面板', click: showPanel},
    {label: state.mode === 'recording' ? '结束并转写' : '开始听写  ⌥Space', enabled: state.mode !== 'transcribing', click: () => sendCommand('toggle')},
    {label: '语音唤醒', type: 'checkbox', checked: state.wakeEnabled, click: () => sendCommand('wake')},
    ...appearanceMenu(),
    {type: 'separator'}, {label: '退出小狗', click: () => app.quit()}
  ]));
}
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', e => e.preventDefault());
  const ses = win.webContents.session;
  ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']}, (_details, callback) => callback({cancel:true}));
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(wc === pet?.webContents && permission === 'media' && details.requestingUrl?.startsWith(ORIGIN + '/') &&
      !details.mediaTypes?.includes('video'));
  });
  ses.setPermissionCheckHandler((wc, permission, origin, details) => wc === pet?.webContents && permission === 'media' &&
    origin.startsWith(ORIGIN) && details.mediaType !== 'video');
}
function handle(name, fn) {ipcMain.handle(name, async (e, ...args) => {trusted(e); return fn(e, ...args);});}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', ()=>pet?.showInactive());
  app.whenReady().then(async () => {
    privateDir();
    try {const s = JSON.parse(fs.readFileSync(settingsPath()));settings.autoCopy = s.autoCopy !== false;settings.silenceSeconds = [1.2,1.8,2.5,3.5].includes(s.silenceSeconds) ? s.silenceSeconds : 1.8;
      settings.showCardOnRecord=s.showCardOnRecord!==false;settings.petScale=[.7,1,1.25].includes(s.petScale)?s.petScale:1;} catch {}
    protocol.handle('hubaoxuebao', async request => {
      const u = new URL(request.url);
      if (u.host !== 'app' || request.method !== 'GET') return new Response('Forbidden', {status: 403});
      let rel;try {rel = decodeURIComponent(u.pathname);} catch {return new Response('', {status: 400});}
      const dest = path.resolve(ASSET_ROOT, '.' + rel);
      if (!dest.startsWith(ASSET_ROOT + path.sep) || !/\.(html|css|js|svg|png|gz|wasm)$/.test(dest)) return new Response('', {status: 403});
      try {return await net.fetch(pathToFileURL(dest).toString());} catch {return new Response('Not found', {status: 404});}
    });
    const area = screen.getPrimaryDisplay().workArea;
    const webPreferences = {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false};
    const overlay={type:'panel',focusable:false,acceptFirstMouse:true,fullscreenable:false,minimizable:false,maximizable:false,
      transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true};
    card = new BrowserWindow({...overlay,...CARD,title:'小狗听写卡片',webPreferences,show:false});
    const size=petSize(settings.petScale);
    pet = new BrowserWindow({...overlay, ...size, x: area.x + Math.max(0,area.width-size.width-CARD.width-36), y: area.y + area.height-size.height-24,
      title: '虎宝雪宝听写', webPreferences, show: false});
    panel = new BrowserWindow({width: 440, height: 630, minWidth: 400, minHeight: 590, title: '虎宝雪宝听写',
      type:'panel',acceptFirstMouse:true,fullscreenable:false,skipTaskbar:true,
      titleBarStyle: 'hiddenInset', backgroundColor: '#F6F7FB', webPreferences, show: false});
    for(const win of [pet,card,panel]) {
      win.setAlwaysOnTop(true,'floating');
      win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});
      secureWindow(win);
    }
    pet.on('move',positionCard);
    const restorePosition=()=>{
      const b=pet.getBounds(),pos=petPosition(b,screen.getDisplayMatching(b).workArea,settings.petScale);
      pet.setPosition(pos.x,pos.y);positionCard();
    };
    screen.on('display-metrics-changed',restorePosition);screen.on('display-removed',restorePosition);
    panel.on('close', e => {if (!quitting) {e.preventDefault(); panel.hide();}});
    card.on('close',e=>{if(!quitting){e.preventDefault();card.hide();}});
    pet.on('close', () => {if (!quitting) app.quit();});
    await Promise.all([pet.loadURL(ORIGIN + '/pet.html'), panel.loadURL(ORIGIN + '/panel.html'),card.loadURL(ORIGIN+'/card.html')]);
    pet.showInactive();
    const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
    icon.setTemplateImage(true);tray = new Tray(icon);tray.on('click', showCard);updateTray();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'虎宝雪宝听写',submenu:[{label:'设置…',accelerator:'Cmd+,',click:showPanel},{type:'separator'},{role:'quit',label:'退出虎宝雪宝听写'}]},
      {label:'听写',submenu:[{label:'展开文字卡片',click:showCard},{label:'开始 / 结束听写',click:()=>sendCommand('toggle')},{label:'取消录音',click:()=>sendCommand('cancel')}]},
      {role:'editMenu',label:'编辑'},
      {role:'windowMenu',label:'窗口'}
    ]));
    const registered = globalShortcut.register('Alt+Space', () => sendCommand('toggle'));
    if (!registered) state.detail = '快捷键被占用，可点击小狗开始';
    powerMonitor.on('suspend', () => {engine?.cancel();sendCommand('suspend');});
    powerMonitor.on('lock-screen', () => {engine?.cancel();sendCommand('suspend');});
    engine = new LocalEngine(app.isPackaged ? path.join(process.resourcesPath,'local-engine') : path.join(__dirname,'../local-engine'), status => {state.localModel=status;broadcast();});
    if (!DEV_TEST) {engine.start().catch(error=>{state.localModel={phase:'error',detail:error.message};broadcast();showCard();});}
    broadcast();
    if (DEV_TEST) {
      setTimeout(async () => {
        try {
          const checks = await Promise.all([pet.webContents.executeJavaScript('document.querySelector("#robot") !== null'), panel.webContents.executeJavaScript('document.querySelector("#transcript") !== null')]);
          console.log('SMOKE', JSON.stringify({windows: checks, microphoneRequested: false, apiCalled: false}));
          const target = process.env.BLUE_SMOKE_SCREENSHOT;
          if (target) {panel.show();const picture = await panel.webContents.capturePage();fs.writeFileSync(target, picture.toPNG());}
          app.exit(checks.every(Boolean) ? 0 : 1);
        } catch {console.error('SMOKE_FAILED');app.exit(1);}
      }, 1800);
    }
  }).catch(() => {console.error('小狗启动失败');app.exit(1);});
}
handle('state', () => snapshot());
handle('settings', (_, s) => {
  if (!s || typeof s.autoCopy !== 'boolean' || ![1.2,1.8,2.5,3.5].includes(s.silenceSeconds) || typeof s.showCardOnRecord!=='boolean' || ![.7,1,1.25].includes(s.petScale)) throw Error('设置无效');
  return savePreferences({autoCopy:s.autoCopy,silenceSeconds:s.silenceSeconds,showCardOnRecord:s.showCardOnRecord,petScale:s.petScale});
});
handle('command', (_, command) => {if (!['toggle','wake','cancel','suspend'].includes(command)) throw Error('无效操作');sendCommand(command);return true;});
handle('microphone', async e => {fromPet(e);if (DEV_TEST) return false;return systemPreferences.askForMediaAccess('microphone');});
handle('copy', (_, text) => {if (typeof text !== 'string' || !text.trim() || text.length > 50000) return false;clipboard.writeText(text);return true;});
handle('cancel-request', async e => {fromPet(e);if(engine?.pending){engine.cancel();try{await engine.start();}catch{}}return true;});
handle('reload-model', async () => {if(pending)throw Error('请等当前听写结束');await engine.start();return true;});
handle('test-model', async () => {
  if(pending)throw Error('请等当前听写结束');
  await engine.start();
  return {ready:engine.ready,model:MODEL};
});
handle('wake-transcribe', async (e,input) => {
  fromPet(e);if(DEV_TEST||pending||state.testRunning)return {text:''};
  const task=engine.transcribe(input);pending=task;
  try{return await task;}catch(error){if(/没有识别到文字/.test(error.message))return {text:''};throw error;}finally{if(pending===task)pending=null;}
});
handle('transcribe', async (e, input) => {
  fromPet(e);if (DEV_TEST) throw Error('测试模式不允许麦克风转写');
  if(pending)await pending.catch(()=>{});
  const task=engine.transcribe(input);pending=task;
  try {
    const result=await task;
    state.text=result.text;state.error='';
    if(settings.autoCopy)clipboard.writeText(result.text);
    if(settings.showCardOnRecord&&!cardDismissed)showCard();broadcast();return {...result,copied:settings.autoCopy};
  } finally {if(pending===task)pending=null;}
});
ipcMain.on('engine-state', (e, value) => {
  fromPet(e);if (!value || !['idle','loading','armed','recording','transcribing','done','error'].includes(value.mode)) return;
  state = {...state, mode: value.mode, wakeEnabled: Boolean(value.wakeEnabled), detail: String(value.detail || '').slice(0,120),
    error: String(value.error || '').slice(0,200), seconds: Math.max(0,Math.min(121,Number(value.seconds)||0)), level: Math.max(0,Math.min(1,Number(value.level)||0))};broadcast();
});
ipcMain.on('show-panel', e => {trusted(e);showPanel();});
ipcMain.on('expand-card', (e,automatic) => {trusted(e);cardDismissed=false;if(automatic!==true||settings.showCardOnRecord)showCard();});
ipcMain.on('collapse-card', e => {trusted(e);cardDismissed=true;card.hide();});
ipcMain.on('pet-menu',e=>{fromPet(e);Menu.buildFromTemplate([
  {label:'展开文字框',click:showCard},...appearanceMenu(),{label:'设置…',click:showPanel},
  {type:'separator'},{label:'退出虎宝雪宝听写',click:()=>app.quit()}
]).popup({window:pet});});
ipcMain.on('close-panel', e => {trusted(e);panel.hide();});
ipcMain.on('drag-pet', (e, point) => {
  fromPet(e);if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const pos = {x: Math.round(point.x), y: Math.round(point.y)};const area = screen.getDisplayNearestPoint(pos).workArea;
  const next=petPosition(pos,area,settings.petScale);pet.setPosition(next.x,next.y);positionCard();
});
app.on('before-quit', () => {quitting = true;engine?.stop();});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('activate', ()=>pet?.showInactive());
