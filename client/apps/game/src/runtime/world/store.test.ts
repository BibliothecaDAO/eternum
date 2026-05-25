// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getActiveWorld,
  getActiveWorldName,
  purgeDeadSlotWorldProfiles,
  purgeUnavailableSlotWorldProfiles,
  resolveRuntimeChain,
} from "./store";
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

  it("returns null for stale slot profiles without mutating storage", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "slot",
        toriiBaseUrl: "https://api.cartridge.gg/x/bltz-riff-363/torii",
        rpcUrl: "https://api.cartridge.gg/x/bltz-riff-363/katana/rpc/v0_9",
        worldAddress: "0x0",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");

    expect(getActiveWorld()).toBeNull();
    expect(getActiveWorldName()).toBe("bltz-riff-363");
    expect(JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}")).toHaveProperty("bltz-riff-363");
  });

  it("purges stale slot profiles and clears the active world pointer", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "slot",
        toriiBaseUrl: "https://api.cartridge.gg/x/bltz-riff-363/torii",
        rpcUrl: "https://api.cartridge.gg/x/bltz-riff-363/katana/rpc/v0_9",
        worldAddress: "0x0",
        contractsBySelector: {},
        fetchedAt: 1,
      },
      "mainnet-king-1": {
        name: "mainnet-king-1",
        chain: "mainnet",
        toriiBaseUrl: "https://api.cartridge.gg/x/mainnet-king-1/torii",
        rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9",
        worldAddress: "0xabc",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");

    purgeUnavailableSlotWorldProfiles();

    const remaining = JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}") as WorldProfilesMap;
    expect(remaining).not.toHaveProperty("bltz-riff-363");
    expect(remaining).toHaveProperty("mainnet-king-1");
    expect(getActiveWorldName()).toBeNull();
  });

  it("purges the slot profiles named in the dead set and clears the active world pointer", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "slot",
        toriiBaseUrl: "https://api.cartridge.gg/x/bltz-riff-363/torii",
        rpcUrl: "https://api.cartridge.gg/x/bltz-riff-363/katana/rpc/v0_9",
        worldAddress: "0x00ffc134aa2e75a419875fe8190cf34a008cd960311a893535c40cf8f8b778c7",
        contractsBySelector: {},
        fetchedAt: 1,
      },
      "eternum-blitz-slot-4": {
        name: "eternum-blitz-slot-4",
        chain: "slot",
        toriiBaseUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/torii",
        rpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
        worldAddress: "0x123",
        contractsBySelector: {},
        fetchedAt: 1,
      },
      "mainnet-king-1": {
        name: "mainnet-king-1",
        chain: "mainnet",
        toriiBaseUrl: "https://api.cartridge.gg/x/mainnet-king-1/torii",
        rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9",
        worldAddress: "0xabc",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");

    const evicted = purgeDeadSlotWorldProfiles(new Set(["bltz-riff-363", "mainnet-king-1"]));

    // Only slot profiles in the dead set are touched; mainnet is never evicted
    // even if (mistakenly) included in the dead set.
    expect(evicted).toEqual(["bltz-riff-363"]);
    const remaining = JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}") as WorldProfilesMap;
    expect(remaining).not.toHaveProperty("bltz-riff-363");
    expect(remaining).toHaveProperty("eternum-blitz-slot-4");
    expect(remaining).toHaveProperty("mainnet-king-1");
    expect(getActiveWorldName()).toBeNull();
  });

  it("no-ops on an empty dead set so an indeterminate probe doesn't false-evict", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "slot",
        toriiBaseUrl: "https://api.cartridge.gg/x/bltz-riff-363/torii",
        rpcUrl: "https://api.cartridge.gg/x/bltz-riff-363/katana/rpc/v0_9",
        worldAddress: "0x00ffc134",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");

    const evicted = purgeDeadSlotWorldProfiles(new Set());

    expect(evicted).toEqual([]);
    const remaining = JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}") as WorldProfilesMap;
    expect(remaining).toHaveProperty("bltz-riff-363");
    expect(getActiveWorldName()).toBe("bltz-riff-363");
  });

  it("uses the active world chain before a saved selected-chain preference", () => {
    saveProfiles({
      "bltz-riff-363": {
        name: "bltz-riff-363",
        chain: "slot",
        toriiBaseUrl: "https://api.cartridge.gg/x/bltz-riff-363/torii",
        rpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
        worldAddress: "0x00ffc134",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    });
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");
    window.localStorage.setItem(CHAIN_KEY, "mainnet");

    expect(resolveRuntimeChain("mainnet")).toBe("slot");
  });

  it("uses the selected-chain preference when no active world exists", () => {
    window.localStorage.setItem(CHAIN_KEY, "slot");

    expect(resolveRuntimeChain("mainnet")).toBe("slot");
  });
});
