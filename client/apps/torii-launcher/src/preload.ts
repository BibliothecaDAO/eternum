// See the Electron documentation for details on how to use preload scripts:

import { IpcRendererEvent } from "electron";
import { IpcMethod, Notification, ProgressUpdatePayload, ToriiConfig } from "./types";

// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
  sendMessage: (channel: IpcMethod, data: unknown) => {
    ipcRenderer.send(channel, data);
  },
  invoke: <T>(channel: IpcMethod, data: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, data);
  },
on: (channel: IpcMethod, func: (event: IpcRendererEvent, ...args: any[]) => void) => {
    const subscription = (event: IpcRendererEvent, ...args: any[]) => func(event, ...args);
    ipcRenderer.on(channel, subscription);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  // Specific listeners can also be cleaner
  onNotification: (callback: (notification: Notification) => void) => {
    const listener = (event: IpcRendererEvent, notification: Notification) => callback(notification);
    ipcRenderer.on(IpcMethod.Notification, listener);
    return () => ipcRenderer.removeListener(IpcMethod.Notification, listener);
  },
  onConfigChanged: (callback: (config: ToriiConfig) => void) => {
    const listener = (event: IpcRendererEvent, config: ToriiConfig) => callback(config);
    ipcRenderer.on(IpcMethod.ConfigWasChanged, listener);
    return () => ipcRenderer.removeListener(IpcMethod.ConfigWasChanged, listener);
  },
  // Add listener for progress updates
  onProgressUpdate: (callback: (payload: ProgressUpdatePayload) => void) => {
    const listener = (event: IpcRendererEvent, payload: ProgressUpdatePayload) => callback(payload);
    ipcRenderer.on(IpcMethod.ProgressUpdate, listener);
    return () => ipcRenderer.removeListener(IpcMethod.ProgressUpdate, listener);
  },
});
