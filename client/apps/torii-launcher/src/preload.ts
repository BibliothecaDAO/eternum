// See the Electron documentation for details on how to use preload scripts:

import { IpcMethod } from "./types";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
  sendMessage: (message: IpcMethod) => ipcRenderer.send(message, {}),
});
