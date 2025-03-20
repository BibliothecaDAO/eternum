export enum IpcMethod {
  ResetDatabase = "resetDatabase",
  KillTorii = "killTorii",
  RequestFirstBlock = "requestFirstBlock",
  SetFirstBlock = "setFirstBlock",
  ChangeConfigType = "changeConfigType",
  Notification = "notification",
  ConfigWasChanged = "configWasChanged",
}

export type Notification = {
  type: "Success" | "Error" | "Info";
  message: string;
};

export type ConfigType = "local" | "mainnet" | "sepolia" | "slot";

export type ToriiConfig = {
  configType: ConfigType;
  world_address: string;
  rpc: string;
  world_block: number;
};
