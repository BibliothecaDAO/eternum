import { IpcMethod } from ".";

declare global {
  interface Window {
    electronAPI: {
      onMessage: (channel: IpcMethod, callback: (data: any) => void) => { remove: () => void };
      sendMessage: (channel: IpcMethod, data: any) => void;
      invoke: <T>(channel: IpcMethod, data: any) => Promise<T>;
    };
  }
}

// This empty export is needed to make TypeScript treat this as a module
export {};
