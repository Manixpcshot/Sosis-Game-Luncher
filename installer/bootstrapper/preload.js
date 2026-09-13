'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('setup', {
  config: () => ipcRenderer.invoke('setup:config'),
  fetchManifest: () => ipcRenderer.invoke('setup:fetchManifest'),
  download: (payload) => ipcRenderer.invoke('setup:download', payload),
  cancel: () => ipcRenderer.invoke('setup:cancel'),
  install: (payload) => ipcRenderer.invoke('setup:install', payload),
  launch: () => ipcRenderer.invoke('setup:launch'),
  quit: () => ipcRenderer.invoke('setup:quit'),
  openExternal: (url) => ipcRenderer.invoke('setup:openExternal', url),
  onProgress: (cb) => ipcRenderer.on('setup:progress', (_e, p) => cb(p))
});
