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

  let toriiUrl = toriiSetting === ToriiSetting.Local ? "http://localhost:8080" : env.VITE_PUBLIC_TORII;

  const aliveCheck = await fetch(toriiUrl);
  if (!aliveCheck.ok && aliveCheck.status !== 200) {
    localStorage.setItem("TORII_SETTING", ToriiSetting.Remote);
    toriiUrl = env.VITE_PUBLIC_TORII;
  }

  return toriiUrl;
};

export const DEFAULT_TORII_SETTING = ToriiSetting.Local;
