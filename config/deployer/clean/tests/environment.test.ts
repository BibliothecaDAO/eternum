import { describe, expect, test } from "bun:test";
import { isEternumDeploymentEnvironment, resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("accepts slot.blitz", () => {
    const environment = resolveDeploymentEnvironment("slot.blitz");
    expect(environment.chain).toBe("slot");
    expect(environment.gameType).toBe("blitz");
    expect(environment.factoryAddress).toBe("0x242226ce5f17914fc148cb111980b24e2bda624379877cda66f7e76884d2deb");
    expect(environment.rpcUrl).toBe("https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9");
    expect(environment.accountAddress).toBe("0x6677fe62ee39c7b07401f754138502bab7fac99d2d3c5d37df7d1c6fab10819");
    expect(environment.privateKey).toBe("0x3e3979c1ed728490308054fe357a9f49cf67f80f9721f44cc57235129e090f4");
    expect(environment.createGame).toEqual({
      maxActions: 300,
      submissionCount: 1,
      retryDelayMs: 0,
    });
  });

  test("accepts mainnet.eternum with the shared mainnet factory default", () => {
    const environment = resolveDeploymentEnvironment("mainnet.eternum");

    expect(environment.chain).toBe("mainnet");
    expect(environment.gameType).toBe("eternum");
    expect(environment.factoryAddress).toBe("0x525410a4d0ebd4a313e2125ac986710cd8f1bd08d47379b7f45c8b9c71b4da");
    expect(environment.rpcUrl).toBe("https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9");
    expect(environment.accountAddress).toBeUndefined();
    expect(environment.privateKey).toBeUndefined();
    expect(environment.createGame).toEqual({
      maxActions: 70,
      submissionCount: 3,
      retryDelayMs: 10000,
    });
  });

  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("invalid.blitz")).toThrow(
      'Unsupported environment "invalid.blitz". Expected one of: mainnet.blitz, mainnet.eternum, slot.blitz, slot.eternum',
    );
  });

  test("keeps eternum-only launch gates separate from blitz", () => {
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("slot.eternum"))).toBe(true);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("slot.blitz"))).toBe(false);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("mainnet.eternum"))).toBe(true);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("mainnet.blitz"))).toBe(false);
  });
});
