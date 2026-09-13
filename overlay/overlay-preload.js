'use strict';
/** Overlay preload — two channels only: receive state, announce readiness. */
const { contextBridge, ipcRenderer } = require('electron');
const { CH } = require('../src/shared/channels');

contextBridge.exposeInMainWorld('sosisOverlay', {
  ready: () => ipcRenderer.send(CH.OVERLAY_READY),
  onState: (cb) => {
    const wrapped = (_e, payload) => cb(payload);
    ipcRenderer.on(CH.OVERLAY_STATE, wrapped);
    return () => ipcRenderer.removeListener(CH.OVERLAY_STATE, wrapped);
  }
});
