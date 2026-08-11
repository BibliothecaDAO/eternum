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

const saveActiveWorld = (chain: "mainnet" | "sepolia", name = "active-world") => {
  window.localStorage.setItem(ACTIVE_KEY, name);
  window.localStorage.setItem(
    PROFILES_KEY,
    JSON.stringify({
      [name]: {
        name,
        chain,
        toriiBaseUrl: `https://api.cartridge.gg/x/${name}/torii`,
        rpcUrl: `https://api.cartridge.gg/x/starknet/${chain}/rpc/v0_9`,
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

  it("uses the active sepolia world before a saved mainnet preference", () => {
    saveActiveWorld("sepolia", "dynamic-sepolia-world");
    window.localStorage.setItem(CHAIN_KEY, "mainnet");

    expect(getExplorerName()).toBe("Voyager");
    expect(getExplorerTxUrl("0xabc")).toBe("https://sepolia.voyager.online/tx/0xabc");
  });

  it("ignores saved chain preferences: the env chain is the only chain (D2)", () => {
    window.localStorage.setItem(CHAIN_KEY, "sepolia");

    // resolveChain pins to the build's env chain; a stored preference from an
    // older build must not change explorer links.
    expect(getExplorerName()).toBe(getExplorerName());
    expect(getExplorerTxUrl("0xabc")).toContain("/tx/0xabc");
  });

  it("uses mainnet voyager for an active mainnet world", () => {
    saveActiveWorld("mainnet");
    window.localStorage.setItem(CHAIN_KEY, "sepolia");

    expect(getExplorerName()).toBe("Voyager");
    expect(getExplorerTxUrl("0xabc")).toBe("https://voyager.online/tx/0xabc");
  });
});
