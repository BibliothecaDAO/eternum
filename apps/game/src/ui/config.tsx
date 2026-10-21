import { FELT_CENTER as FELT_CENTER_IMPORT } from "@bibliothecadao/eternum";

export const FELT_CENTER = FELT_CENTER_IMPORT;

const getBrowserLocalStorage = (): Storage | null => {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
};

const getBrowserNavigator = (): Navigator | null => {
  return typeof globalThis.navigator === "undefined" ? null : globalThis.navigator;
};

const getFlatMode = () => {
  const browserLocalStorage = getBrowserLocalStorage();
  if (!browserLocalStorage) {
    return false;
  }

  const flatMode = browserLocalStorage.getItem("FLAT_MODE");
  return flatMode === null ? false : flatMode === "true";
};

export const IS_FLAT_MODE = getFlatMode();

export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  getBrowserNavigator()?.userAgent ?? "",
);
