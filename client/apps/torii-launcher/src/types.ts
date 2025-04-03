export enum IpcMethod {
  StartTorii = "start-torii",
  ResetDatabase = "reset-database",
  KillTorii = "kill-torii",
  ChangeConfigType = "change-config-type",
  Notification = "notification",
  ConfigWasChanged = "config-was-changed",
  ProgressUpdate = "progress-update",
}

export enum NotificationType {
  Success,
  Error,
  Info,
}

export type Notification = {
  type: NotificationType;
  message: string;
  timestampMs: number;
};

// Define the possible config types as a constant array
export const CONFIG_TYPES = ["mainnet", "sepolia", "slot", "local"] as const;

// Derive the ConfigType union type from the array
export type ConfigType = (typeof CONFIG_TYPES)[number];

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
