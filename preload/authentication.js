const { contextBridge, ipcRenderer } = require('electron');
const config = require('../config.json');

contextBridge.exposeInMainWorld("ipc", {
    send: (channel, arg = []) => ipcRenderer.send(channel, arg),
    sendSync: (channel, arg = []) => ipcRenderer.sendSync(channel, arg),
    on: (channel, func) => ipcRenderer.on(channel, func),
    config: config
});

