import { env } from "../../env";

/**
 * Runtime developer mode: the FPS/memory stats panel, the Leva graphics GUI,
 * the stats recorder, and the sync readout. The build-time
 * VITE_PUBLIC_GRAPHICS_DEV flag still forces it on for dev builds; deployed
 * builds toggle it per browser with `?dev` (persisted) or `?dev=0` to clear.
 * Consumers read the flag at module init, so changing it takes a reload.
 */
const STORAGE_KEY = "eternum:dev-mode";

const readRuntimeFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("dev")) {
      const enabled = params.get("dev") !== "0";
      window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
      return enabled;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const DEV_MODE_ENABLED: boolean = env.VITE_PUBLIC_GRAPHICS_DEV === true || readRuntimeFlag();

/**
 * Opt-in console verbosity for the high-volume debug streams (chunk traces,
 * interaction traces, memory-spike reports, audio/realtime debug lines).
 * `?logs=1` enables it for this page load only. Default off — a readable
 * console is the norm, firehoses are the exception.
 */
const readVerboseFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("logs") && params.get("logs") !== "0";
  } catch {
    return false;
  }
};

export const VERBOSE_LOGS_ENABLED: boolean = readVerboseFlag();

/**
 * The one sanctioned home for informational console output. Silent unless
 * `?logs=1` — console.log/info/debug outside this helper fails the
 * console-discipline source test.
 */
export const verboseLog = (...args: unknown[]): void => {
  if (VERBOSE_LOGS_ENABLED) console.log(...args);
};

export const setDevModeEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // storage unavailable — the ?dev param still works per load
  }
};
