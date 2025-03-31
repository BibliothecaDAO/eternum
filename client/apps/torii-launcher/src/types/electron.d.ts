import { IpcMethod, Notification, ProgressUpdatePayload, ToriiConfig } from "./types"; // Added ProgressUpdatePayload import

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ElectronAPI {
  sendMessage: (channel: IpcMethod, data?: unknown) => void;
  invoke: <T>(channel: IpcMethod, data?: unknown) => Promise<T>;
  on: (channel: IpcMethod, func: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => () => void; // Added return type based on preload.ts implementation
  // Specific listeners
  onNotification: (callback: (notification: Notification) => void) => () => void; // Added return type
  onConfigChanged: (callback: (config: ToriiConfig) => void) => () => void; // Added return type
  // Add the definition for onProgressUpdate
  onProgressUpdate: (callback: (payload: ProgressUpdatePayload) => void) => () => void;
}
