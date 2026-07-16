const { contextBridge, ipcRenderer } = require('electron');

// Exposing protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  exportPdf: (payload) => ipcRenderer.invoke('pdf:export', payload),
});
