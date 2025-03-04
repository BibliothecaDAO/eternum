// See the Electron documentation for details on how to use preload scripts:

import { IpcMethod } from "./types";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
  sendMessage: (message: IpcMethod, data?: any) => ipcRenderer.send(message, data),
  invoke: (message: IpcMethod, data?: any) => ipcRenderer.invoke(message, data),
  onMessage: (message: IpcMethod, callback: (data: any) => void) => {
    ipcRenderer.on(message, (_event: any, data: any) => {
      callback(data);
    });
    return () => ipcRenderer.removeListener(message, callback);
  },
});
