'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('blue', Object.freeze({
  state: () => ipcRenderer.invoke('state'),
  reloadModel: () => ipcRenderer.invoke('reload-model'),
  testModel: () => ipcRenderer.invoke('test-model'),
  settings: value => ipcRenderer.invoke('settings', value),
  command: value => ipcRenderer.invoke('command', value),
  microphone: () => ipcRenderer.invoke('microphone'),
  wakeTranscribe: bytes => ipcRenderer.invoke('wake-transcribe', bytes),
  transcribe: bytes => ipcRenderer.invoke('transcribe', bytes),
  cancelRequest: () => ipcRenderer.invoke('cancel-request'),
  update: value => ipcRenderer.send('engine-state', value),
  copy: text => ipcRenderer.invoke('copy', text),
  showPanel: () => ipcRenderer.send('show-panel'),
  expandCard: automatic => ipcRenderer.send('expand-card',automatic===true),
  petMenu: () => ipcRenderer.send('pet-menu'),
  collapseCard: () => ipcRenderer.send('collapse-card'),
  closePanel: () => ipcRenderer.send('close-panel'),
  drag: value => ipcRenderer.send('drag-pet', value),
  onState: fn => {const listener = (_, value) => fn(value); ipcRenderer.on('state-changed', listener); return () => ipcRenderer.removeListener('state-changed', listener);},
  onPanelTab: fn => {const listener = (_, value) => fn(value); ipcRenderer.on('panel-tab', listener); return () => ipcRenderer.removeListener('panel-tab', listener);},
  onCommand: fn => {const listener = (_, value) => fn(value); ipcRenderer.on('engine-command', listener); return () => ipcRenderer.removeListener('engine-command', listener);}
}));
