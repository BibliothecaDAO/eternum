import { ToriiSetting } from "@/types";
import type { Chain } from "@config";

export const DEFAULT_TORII_SETTING = ToriiSetting.Remote;
export const LOCAL_TORII_URL = "http://localhost:8080";

type ToriiFallbackContext = {
  chain: Chain;
  isDev: boolean;
};

export const isToriiSetting = (value: string | null): value is ToriiSetting => {
  return value === ToriiSetting.Local || value === ToriiSetting.Remote;
};

export const resolveToriiUrlForSetting = (setting: ToriiSetting, remoteToriiUrl: string): string => {
  return setting === ToriiSetting.Local ? LOCAL_TORII_URL : remoteToriiUrl;
};

export const resolveUnavailableToriiFallbackSetting = (
  setting: ToriiSetting,
  context: ToriiFallbackContext,
): ToriiSetting | null => {
  if (setting === ToriiSetting.Local) {
    return ToriiSetting.Remote;
  }

  if (canAutomaticallyUseLocalTorii(context)) {
    return ToriiSetting.Local;
  }

  return null;
};

const canAutomaticallyUseLocalTorii = ({ chain, isDev }: ToriiFallbackContext): boolean => {
  return isDev || chain === "local";
};
