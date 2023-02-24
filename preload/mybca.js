const { contextBridge, ipcRenderer } = require('electron');
window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        ipcRenderer.send("testing");
    }, 2000);

})