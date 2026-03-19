import { ToriiSetting } from "@/types";
import { ContractComponents, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Chain, GameType, getConfigFromNetwork } from "@config";
import { env } from "./../../env";

type ConfigResolutionOptions = {
  chain?: Chain;
  gameType?: GameType;
  components?: ContractComponents;
};

const getForcedGameType = (): GameType | null => {
  const forcedGameType = env.VITE_PUBLIC_FORCE_GAME_MODE_ID;
  if (!forcedGameType) {
    return null;
  }

  return forcedGameType;
};

const resolveGameTypeFromComponents = (components: ContractComponents): GameType => {
  const worldConfig = getComponentValue(components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
  return worldConfig?.blitz_mode_on ? "blitz" : "eternum";
};

const resolveGameType = (options?: ConfigResolutionOptions): GameType => {
  if (options?.gameType) {
    return options.gameType;
  }

  const forcedGameType = getForcedGameType();
  if (forcedGameType) {
    return forcedGameType;
  }

  if (options?.components) {
    return resolveGameTypeFromComponents(options.components);
  }

  return "eternum";
};

export const ETERNUM_CONFIG = (options: ConfigResolutionOptions = {}) => {
  const chain = options.chain ?? (env.VITE_PUBLIC_CHAIN as Chain);
  const gameType = resolveGameType(options);
  return getConfigFromNetwork(chain, gameType);
};

export const TORII_SETTING = async (): Promise<string> => {
  let toriiSetting = localStorage.getItem("TORII_SETTING") as ToriiSetting;
  if (!toriiSetting) {
    localStorage.setItem("TORII_SETTING", DEFAULT_TORII_SETTING);
    toriiSetting = DEFAULT_TORII_SETTING;
  }

  let toriiUrl = settingToUrl(toriiSetting);

  const isAlive = await doAliveCheck(toriiUrl);

  if (!isAlive) {
    const newSetting = getOppositeSetting(toriiSetting);
    localStorage.setItem("TORII_SETTING", newSetting);
    toriiUrl = settingToUrl(newSetting);
  }

  return toriiUrl;
};

export const DEFAULT_TORII_SETTING = ToriiSetting.Remote;

const settingToUrl = (setting: ToriiSetting) => {
  return setting === ToriiSetting.Local ? "http://localhost:8080" : env.VITE_PUBLIC_TORII;
};

const getOppositeSetting = (setting: ToriiSetting) => {
  return setting === ToriiSetting.Local ? ToriiSetting.Remote : ToriiSetting.Local;
};

const doAliveCheck = async (url: string) => {
  try {
    const aliveCheck = await fetch(url);
    return aliveCheck.ok && aliveCheck.status === 200;
  } catch (error) {
    return false;
  }
};
