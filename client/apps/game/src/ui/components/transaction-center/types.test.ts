// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getExplorerName, getExplorerTxUrl } from "./types";

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

const saveActiveWorld = (chain: "mainnet" | "slot", name = "active-world") => {
  window.localStorage.setItem(ACTIVE_KEY, name);
  window.localStorage.setItem(
    PROFILES_KEY,
    JSON.stringify({
      [name]: {
        name,
        chain,
        toriiBaseUrl: `https://api.cartridge.gg/x/${name}/torii`,
        rpcUrl:
          chain === "mainnet"
            ? "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9"
            : "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
        worldAddress: "0x123",
        contractsBySelector: {},
        fetchedAt: 1,
      },
    }),
  );
};

describe("transaction explorer links", () => {
  beforeEach(() => {
    const localStorage = createLocalStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", { localStorage });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("uses the active slot world before a saved mainnet preference", () => {
    saveActiveWorld("slot", "dynamic-slot-world");
    window.localStorage.setItem(CHAIN_KEY, "mainnet");

    expect(getExplorerName()).toBe("Katana Explorer");
    expect(getExplorerTxUrl("0xabc")).toBe("https://api.cartridge.gg/x/dynamic-slot-world/katana/explorer/tx/0xabc");
  });

  it("falls back to the build slot name when no active world exists", () => {
    window.localStorage.setItem(CHAIN_KEY, "slot");

    expect(getExplorerName()).toBe("Katana Explorer");
    expect(getExplorerTxUrl("0xabc")).toBe("https://api.cartridge.gg/x/test-slot/katana/explorer/tx/0xabc");
  });

  it("uses mainnet voyager for an active mainnet world", () => {
    saveActiveWorld("mainnet");
    window.localStorage.setItem(CHAIN_KEY, "slot");

    expect(getExplorerName()).toBe("Voyager");
    expect(getExplorerTxUrl("0xabc")).toBe("https://voyager.online/tx/0xabc");
  });
});
