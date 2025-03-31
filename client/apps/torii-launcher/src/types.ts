export enum IpcMethod {
  ResetDatabase = "reset-database",
  KillTorii = "kill-torii",
  ChangeConfigType = "change-config-type",
  Notification = "notification",
  ConfigWasChanged = "config-was-changed",
  ProgressUpdate = "progress-update",
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

export type ProgressUpdatePayload = {
  progress: number;
  initialToriiBlock: number | null;
  currentToriiBlock: number;
  currentChainBlock: number;
};
