import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToriiClient } from "@dojoengine/torii-client";
import type { ProviderInterface } from "starknet";

const { initMetagameMock } = vi.hoisted(() => ({
  initMetagameMock: vi.fn(),
}));

vi.mock("metagame-sdk", () => ({
  initMetagame: initMetagameMock,
}));

import { ensureMetagameClientInitialized, resetMetagameClientInitializationForTests } from "./metagame-client";

describe("ensureMetagameClientInitialized", () => {
  beforeEach(() => {
    initMetagameMock.mockReset();
    resetMetagameClientInitializationForTests();
  });

  it("initializes the metagame singleton once", () => {
    const provider = { chainId: "SN_MAIN" } as unknown as ProviderInterface;
    const toriiClient = { query: vi.fn() } as unknown as ToriiClient;
    const toriiUrl = "https://example.com/torii";

    expect(ensureMetagameClientInitialized({ provider, toriiClient, toriiUrl })).toBe(true);
    expect(ensureMetagameClientInitialized({ provider, toriiClient, toriiUrl })).toBe(true);

    expect(initMetagameMock).toHaveBeenCalledTimes(1);
  });

  it("returns false when dependencies are missing", () => {
    const provider = { chainId: "SN_MAIN" } as unknown as ProviderInterface;
    const toriiClient = { query: vi.fn() } as unknown as ToriiClient;
    const toriiUrl = "https://example.com/torii";

    expect(ensureMetagameClientInitialized({ provider: null, toriiClient, toriiUrl })).toBe(false);
    expect(ensureMetagameClientInitialized({ provider, toriiClient: null, toriiUrl })).toBe(false);
    expect(ensureMetagameClientInitialized({ provider, toriiClient, toriiUrl: "" })).toBe(false);

    expect(initMetagameMock).not.toHaveBeenCalled();
  });
});
