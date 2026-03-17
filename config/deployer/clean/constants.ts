import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_NAMESPACE = "s1_eternum";
export const DEFAULT_VERSION = "180";
export const DEFAULT_MAX_ACTIONS = 300;
export const DEFAULT_FACTORY_INDEX_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_POLL_MS = 5_000;
export const DEFAULT_CARTRIDGE_API_BASE = "https://api.cartridge.gg";
export const DEFAULT_TORII_WORKFLOW_FILE = "factory-torii-deployer.yml";
export const DEFAULT_INDEXER_WORKFLOW_TIMEOUT_MS = 20 * 60 * 1000;
export const DEFAULT_INDEXER_WORKFLOW_POLL_MS = 5_000;
export const DEFAULT_VRF_PROVIDER_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
export const DEFAULT_SLOT_FACTORY_ADDRESS = "0x242226ce5f17914fc148cb111980b24e2bda624379877cda66f7e76884d2deb";
export const DEFAULT_SLOT_RPC_URL = "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9";
export const DEFAULT_SLOT_ACCOUNT_ADDRESS = "0x6677fe62ee39c7b07401f754138502bab7fac99d2d3c5d37df7d1c6fab10819";
export const DEFAULT_SLOT_PRIVATE_KEY = "0x3e3979c1ed728490308054fe357a9f49cf67f80f9721f44cc57235129e090f4";

export const BANK_COUNT = 6;
export const BANK_STEPS_FROM_CENTER = 15 * 21;
export const BANK_NAME_PREFIX = "Central Bank";

const SLOT_DEFAULTS = {
  factoryAddress: DEFAULT_SLOT_FACTORY_ADDRESS,
  rpcUrl: DEFAULT_SLOT_RPC_URL,
  accountAddress: DEFAULT_SLOT_ACCOUNT_ADDRESS,
  privateKey: DEFAULT_SLOT_PRIVATE_KEY,
};

export const DEPLOYMENT_ENVIRONMENTS: Record<DeploymentEnvironmentId, DeploymentEnvironment> = {
  "slot.blitz": {
    id: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    toriiEnv: "slot",
    configPath: "config/environments/data/blitz.slot.json",
    ...SLOT_DEFAULTS,
  },
  "slot.eternum": {
    id: "slot.eternum",
    chain: "slot",
    gameType: "eternum",
    toriiEnv: "slot",
    configPath: "config/environments/data/eternum.slot.json",
    ...SLOT_DEFAULTS,
  },
};
