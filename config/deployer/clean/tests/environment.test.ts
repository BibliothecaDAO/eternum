import { describe, expect, test } from "bun:test";
import { resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("accepts slot.blitz", () => {
    const environment = resolveDeploymentEnvironment("slot.blitz");
    expect(environment.chain).toBe("slot");
    expect(environment.gameType).toBe("blitz");
    expect(environment.factoryAddress).toBe("0x242226ce5f17914fc148cb111980b24e2bda624379877cda66f7e76884d2deb");
    expect(environment.rpcUrl).toBe("https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9");
    expect(environment.accountAddress).toBe("0x6677fe62ee39c7b07401f754138502bab7fac99d2d3c5d37df7d1c6fab10819");
    expect(environment.privateKey).toBe("0x3e3979c1ed728490308054fe357a9f49cf67f80f9721f44cc57235129e090f4");
  });

  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("mainnet.blitz")).toThrow(
      'Unsupported environment "mainnet.blitz". Expected one of: slot.blitz, slot.eternum',
    );
  });
});
