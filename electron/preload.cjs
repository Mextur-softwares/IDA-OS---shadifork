const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('idaDesktop', Object.freeze({
  isElectron: true
}));
