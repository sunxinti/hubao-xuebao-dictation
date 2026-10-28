const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {EventEmitter}=require('node:events');
test('dictation stays non-activating, respects a hidden card, and persists pet size',async()=>{
 const windows=[],handlers=new Map(),copies=[],writes=[];const area={x:0,y:25,width:1440,height:850};
 class Window extends EventEmitter {
  constructor(options){super();this.options=options;this.bounds={x:0,y:0,...options};this.visible=false;windows.push(this);
   this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},send(){},setWindowOpenHandler(){},session:{webRequest:{onBeforeRequest(){}},setPermissionRequestHandler(){},setPermissionCheckHandler(){}}});
  }
  async loadURL(url){this.webContents.mainFrame.url=url;}
  isDestroyed(){return false;}getBounds(){return this.bounds;}setBounds(b){this.bounds={...this.bounds,...b};}setPosition(x,y){this.setBounds({x,y});}
  setAlwaysOnTop(){}setVisibleOnAllWorkspaces(value,options){this.workspaces={value,...options};}
  showInactive(){this.visible=true;}hide(){this.visible=false;}
  show(){throw Error('Unexpected activating show');}focus(){throw Error('Unexpected focus');}
 }
 const app=new EventEmitter();Object.assign(app,{isPackaged:true,setName(){},getPath:()=>'/test-only',commandLine:{appendSwitch(){}},requestSingleInstanceLock:()=>true,whenReady:async()=>{},quit(){},exit(){}});
 const ipc=new EventEmitter();ipc.handle=(name,fn)=>handlers.set(name,fn);
 class Engine{constructor(root,notify){this.root=root;this.notify=notify;}async start(){this.notify({phase:'ready'});}async transcribe(){return {text:'回归测试示例文字'};}stop(){}}
 class Tray{setToolTip(){}setContextMenu(){}on(){}}
 const electron={app,BrowserWindow:Window,ipcMain:ipc,protocol:{registerSchemesAsPrivileged(){},handle(){}},net:{},Menu:{buildFromTemplate:items=>({items,popup(){}}),setApplicationMenu(){}},Tray,nativeImage:{createFromPath:()=>({setTemplateImage(){}})},globalShortcut:{register:()=>true,unregisterAll(){}},clipboard:{writeText:text=>copies.push(text)},systemPreferences:{},screen:Object.assign(new EventEmitter(),{getPrimaryDisplay:()=>({workArea:area}),getDisplayMatching:()=>({workArea:area}),getDisplayNearestPoint:()=>({workArea:area})}),powerMonitor:new EventEmitter()};
 const root=path.join(__dirname,'../src');
 vm.runInNewContext(fs.readFileSync(path.join(root,'main.cjs'),'utf8'),{require:name=>name==='electron'?electron:name==='node:fs'?{mkdirSync(){},readFileSync:()=>'{"showCardOnRecord":false,"petScale":0.7}',writeFileSync:(...args)=>writes.push(args)}:name==='./local-engine.cjs'?{LocalEngine:Engine}:name.startsWith('./')?require(path.join(root,name)):require(name),__dirname:root,process:{argv:[],resourcesPath:'/test-only',env:{}},console,Buffer,URL,Response});
 await new Promise(resolve=>setImmediate(resolve));
 const pet=windows.find(w=>w.webContents.mainFrame.url.endsWith('/pet.html')),card=windows.find(w=>w.webContents.mainFrame.url.endsWith('/card.html')),panel=windows.find(w=>w.webContents.mainFrame.url.endsWith('/panel.html'));
 const e={sender:pet.webContents,senderFrame:pet.webContents.mainFrame};
 for(const w of [pet,card]){assert.equal(w.options.type,'panel');assert.equal(w.options.focusable,false);assert.equal(w.options.acceptFirstMouse,true);assert.equal(w.workspaces.visibleOnFullScreen,true);}
 assert.equal(pet.bounds.width,140);assert.equal(pet.bounds.height,143);
 ipc.emit('expand-card',e,true);assert.equal(card.visible,false);
 await handlers.get('transcribe')(e,new ArrayBuffer(0));assert.equal(card.visible,false);assert.equal(panel.visible,false);assert.deepEqual(copies,['回归测试示例文字']);
 ipc.emit('expand-card',e,false);assert.equal(card.visible,true);
 await handlers.get('settings')(e,{autoCopy:true,silenceSeconds:2.5,showCardOnRecord:true,petScale:1.25});
 assert.equal(pet.bounds.width,250);assert.equal(pet.bounds.height,255);assert.equal(JSON.parse(writes.at(-1)[1]).petScale,1.25);
 ipc.emit('collapse-card',e);await handlers.get('transcribe')(e,new ArrayBuffer(0));assert.equal(card.visible,false,'manually dismissed card must stay dismissed for the current recording');assert.equal(panel.visible,false);
});
