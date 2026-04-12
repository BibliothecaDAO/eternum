// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { ResolvedEntryContext } from "@/game-entry/context";
import type { BootstrappedEntrySession } from "./bootstrap";
import { resolveCachedEntrySessionForContext } from "./bootstrap-session-context";

const createContext = (overrides: Partial<ResolvedEntryContext>): ResolvedEntryContext => ({
  chain: "mainnet",
  worldName: "iron-age",
  intent: "play",
  autoSettle: false,
  hyperstructuresLeft: null,
  source: "landing",
  ...overrides,
});

const createSession = (context: ResolvedEntryContext): BootstrappedEntrySession => ({
  context,
  profile: {
    name: context.worldName,
    chain: context.chain,
    toriiBaseUrl: "https://api.cartridge.gg/x/iron-age/torii",
    rpcUrl: "https://api.cartridge.gg/x/iron-age/katana/rpc/v0_9",
    worldAddress: "0x1",
    contractsBySelector: {},
    fetchedAt: 0,
  },
  setupResult: {} as never,
});

describe("resolveCachedEntrySessionForContext", () => {
  it("rebinds a cached session to the current entry context without losing the bootstrapped result", () => {
    const cachedSession = createSession(createContext({ intent: "spectate" }));
    const currentContext = createContext({ intent: "play" });

    const reboundSession = resolveCachedEntrySessionForContext(cachedSession, currentContext);

    expect(reboundSession).toEqual({
      ...cachedSession,
      context: currentContext,
    });
    expect(reboundSession.profile).toBe(cachedSession.profile);
    expect(reboundSession.setupResult).toBe(cachedSession.setupResult);
  });
});
