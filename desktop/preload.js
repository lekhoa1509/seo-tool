const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadAndInstall: (asset) => ipcRenderer.invoke('update:download-and-install', asset),
  onDownloadProgress: (callback) => {
    const listener = (event, percent) => callback(percent);
    ipcRenderer.on('update:download-progress', listener);
    return () => ipcRenderer.removeListener('update:download-progress', listener);
  },
  onInstallStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('update:install-status', listener);
    return () => ipcRenderer.removeListener('update:install-status', listener);
  },
});
