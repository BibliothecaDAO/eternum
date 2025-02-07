import { MAINNET_RPC_URL, SEPOLIA_RPC_URL, SEPOLIA_WORLD_BLOCK } from "./constants";

import { MAINNET_WORLD_BLOCK } from "./constants";

export enum IpcMethod {
  ResetDatabase = "resetDatabase",
  KillTorii = "killTorii",
  RequestFirstBlock = "requestFirstBlock",
  SetFirstBlock = "setFirstBlock",
  ChangeRpc = "changeRpc",
  Notification = "notification",
  RpcWasChanged = "rpcSet",
}

export type Notification = {
  type: "Success" | "Error" | "Info";
  message: string;
};

export const Rpc: { [key: string]: CurrentRpc } = {
  Sepolia: {
    name: "Sepolia",
    url: SEPOLIA_RPC_URL,
    worldBlock: SEPOLIA_WORLD_BLOCK,
  },
  Mainnet: {
    name: "Mainnet",
    url: MAINNET_RPC_URL,
    worldBlock: MAINNET_WORLD_BLOCK,
  },
  Localhost: {
    name: "Localhost",
    url: "http://localhost:5050",
    worldBlock: 0,
  },
};

export type CurrentRpc = {
  name: string;
  url: string;
  worldBlock: number;
};
