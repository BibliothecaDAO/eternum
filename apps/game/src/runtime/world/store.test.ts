// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getActiveWorld, getActiveWorldName, getWorldProfile, resolveRuntimeChain } from "./store";
import type { WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";
const PROFILES_KEY = "WORLD_PROFILES";

const createLocalStorage = () => {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

const saveProfiles = (profiles: WorldProfilesMap) => {
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
};

describe("world profile store", () => {
  beforeEach(() => {
    const localStorage = createLocalStorage();
    vi.stubGlobal(
      "CustomEvent",
      class CustomEvent<T> extends Event {
        detail: T;

        constructor(type: string, eventInitDict?: CustomEventInit<T>) {
          super(type);
          this.detail = eventInitDict?.detail as T;
        }
      },
    );
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      localStorage,
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a saved profile and its active pointer", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "appchain",
        toriiBaseUrl: "http://realms-appchain.invalid:8080",
        rpcUrl: "http://realms-appchain.invalid",
        worldAddress: "0x00ffc134",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");

    expect(getActiveWorld()?.name).toBe("bltz-riff-363");
    expect(getWorldProfile("bltz-riff-363")?.gameId).toBeUndefined();
    expect(getActiveWorldName()).toBe("bltz-riff-363");
    expect(JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}")).toHaveProperty("bltz-riff-363");
  });

  it("uses the active world chain before a saved selected-chain preference", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "appchain",
        toriiBaseUrl: "http://realms-appchain.invalid:8080",
        rpcUrl: "http://realms-appchain.invalid",
        worldAddress: "0x00ffc134",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");
    window.localStorage.setItem(CHAIN_KEY, "madara");

    expect(resolveRuntimeChain("madara")).toBe("appchain");
  });
});
