const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    sendMessage: (message) => {
        ipcRenderer.send('message-from-renderer', message);
    }
})