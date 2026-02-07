import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ctorCalls: [] as any[],
}));

vi.mock("@cartridge/controller/session/node", () => ({
  default: class {
    constructor(opts: unknown) {
      mocks.ctorCalls.push(opts);
    }

    async probe() {
      return undefined;
    }

    async connect() {
      return { address: "0xsession" };
    }

    async disconnect() {
      return undefined;
    }
  },
}));

import { ControllerSession, buildSessionPoliciesFromManifest } from "../../src/session/controller-session";

describe("controller session policies", () => {
  it("builds Eternum session policies from manifest system contracts", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0x111" },
        { tag: "s1_eternum-guild_systems", address: "0x222" },
      ],
    } as any);

    expect(policies.contracts?.["0x111"]).toBeDefined();
    expect(policies.contracts?.["0x111"]?.methods?.some((m: any) => m.entrypoint === "send_resources")).toBe(true);
    expect(policies.contracts?.["0x222"]?.methods?.some((m: any) => m.entrypoint === "update_whitelist")).toBe(true);
  });

  it("passes generated policies to SessionProvider", () => {
    new ControllerSession({
      rpcUrl: "http://localhost:5050",
      chainId: "SN_SEPOLIA",
      basePath: ".cartridge",
      manifest: {
        contracts: [{ tag: "s1_eternum-resource_systems", address: "0xabc" }],
      } as any,
    });

    expect(mocks.ctorCalls).toHaveLength(1);
    const opts = mocks.ctorCalls[0];
    expect(opts.basePath).toBe(".cartridge");
    expect(opts.policies?.contracts?.["0xabc"]).toBeDefined();
  });
});
