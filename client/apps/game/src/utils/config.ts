import { resolveGameModeFromBlitzFlag } from "@/config/game-modes/resolved-mode";

import { ContractComponents } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { Chain, GameType, getConfigFromNetwork } from "@config";
import { env } from "./../../env";
import { worldConfigKey } from "@/dojo/game-scope";
import {
  DEFAULT_TORII_SETTING,
  isToriiSetting,
  resolveToriiUrlForSetting,
  resolveUnavailableToriiFallbackSetting,
} from "./torii-setting";

type ConfigResolutionOptions = {
  chain?: Chain;
  gameType?: GameType;
  components?: ContractComponents;
};

const resolveGameTypeFromComponents = (components: ContractComponents): GameType => {
  const worldConfig = getComponentValue(components.WorldConfig, worldConfigKey());
  return resolveGameModeFromBlitzFlag(worldConfig?.blitz_mode_on) === "blitz" ? "blitz" : "eternum";
};

const resolveGameType = (options?: ConfigResolutionOptions): GameType => {
  if (options?.gameType) {
    return options.gameType;
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
  const toriiSetting = readToriiSetting();
  const toriiUrl = resolveToriiUrlForSetting(toriiSetting, env.VITE_PUBLIC_TORII);

  if (await doAliveCheck(toriiUrl)) {
    return toriiUrl;
  }

  const fallbackSetting = resolveUnavailableToriiFallbackSetting(toriiSetting, {
    chain: env.VITE_PUBLIC_CHAIN as Chain,
    isDev: import.meta.env.DEV,
  });

  if (!fallbackSetting) {
    return toriiUrl;
  }

  localStorage.setItem("TORII_SETTING", fallbackSetting);
  return resolveToriiUrlForSetting(fallbackSetting, env.VITE_PUBLIC_TORII);
};

const doAliveCheck = async (url: string) => {
  try {
    const aliveCheck = await fetch(url);
    return aliveCheck.ok && aliveCheck.status === 200;
  } catch {
    return false;
  }
};

const readToriiSetting = () => {
  const storedSetting = localStorage.getItem("TORII_SETTING");
  if (isToriiSetting(storedSetting)) {
    return storedSetting;
  }

  localStorage.setItem("TORII_SETTING", DEFAULT_TORII_SETTING);
  return DEFAULT_TORII_SETTING;
};
