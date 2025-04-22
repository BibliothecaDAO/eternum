import { ToriiSetting } from "@/types";
import { Chain, getConfigFromNetwork } from "@config";
import { env } from "./../../env";

export const ETERNUM_CONFIG = () => {
  const config = getConfigFromNetwork(env.VITE_PUBLIC_CHAIN! as Chain);
  return config;
};

export const TORII_SETTING = async (): Promise<string> => {
  let toriiSetting = localStorage.getItem("TORII_SETTING") as ToriiSetting;
  if (!toriiSetting) {
    localStorage.setItem("TORII_SETTING", DEFAULT_TORII_SETTING);
    toriiSetting = DEFAULT_TORII_SETTING;
  }

  let toriiUrl = settingToUrl(toriiSetting);

  let isAlive = await doAliveCheck(toriiUrl);

  if (!isAlive) {
    const newSetting = getOppositeSetting(toriiSetting);
    localStorage.setItem("TORII_SETTING", newSetting);
    toriiUrl = settingToUrl(newSetting);
  }

  return toriiUrl;
};

export const DEFAULT_TORII_SETTING = ToriiSetting.Local;

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
