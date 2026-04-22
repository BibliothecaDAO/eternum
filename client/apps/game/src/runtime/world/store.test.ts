// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getActiveWorld, getActiveWorldName } from "./store";
import type { WorldProfilesMap } from "./types";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
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

  it("clears stale slot profiles that were saved with a missing deployment", () => {
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
    expect(getActiveWorldName()).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}")).not.toHaveProperty("bltz-riff-363");
  });
});
