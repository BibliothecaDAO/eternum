import { describe, expect, test } from "bun:test";
import { DEFAULT_APPCHAIN_RPC_URL, DEFAULT_MADARA_RPC_URL } from "../constants";
import { isEternumDeploymentEnvironment, resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("accepts appchain.blitz", () => {
    const environment = resolveDeploymentEnvironment("appchain.blitz");
    expect(environment.chain).toBe("appchain");
    expect(environment.gameType).toBe("blitz");
    expect(environment.rpcUrl).toBe(DEFAULT_APPCHAIN_RPC_URL);
    expect(environment.accountAddress).toBeUndefined();
    expect(environment.privateKey).toBeUndefined();
    expect(environment.world).toEqual({
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_appchain_blitz.json",
      registrarAddress: "0x27853c5cafdfb2561e47fc0c250b51bc651cb441a3e3a846c99f29ad752b6f0",
    });
  });

  test("resolves the eternum appchain manifest independently", () => {
    const environment = resolveDeploymentEnvironment("appchain.eternum");

    expect(environment.world).toEqual({
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_appchain_eternum.json",
      registrarAddress: "0x4b10e72d41ffe5edcf9254ab03f4ca58b5863b82bb2e2011ce4fdab849d939b",
    });
  });

  test("accepts madara.blitz with the lab registrar", () => {
    const environment = resolveDeploymentEnvironment("madara.blitz");

    expect(environment.chain).toBe("madara");
    expect(environment.gameType).toBe("blitz");
    expect(environment.rpcUrl).toBe(DEFAULT_MADARA_RPC_URL);
    expect(environment.accountAddress).toBeUndefined();
    expect(environment.privateKey).toBeUndefined();
    expect(environment.world).toEqual({
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_madara.json",
      registrarAddress: "0x23d89ba402b33599107413ddb0f33f0cc38e57dcff4aa3b1989cba12076e9a5",
    });
  });

  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("invalid.blitz")).toThrow(
      'Unsupported environment "invalid.blitz". Expected one of: madara.blitz, appchain.blitz, appchain.eternum',
    );
  });

  test("keeps eternum-only launch gates separate from blitz", () => {
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("appchain.eternum"))).toBe(true);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("appchain.blitz"))).toBe(false);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("madara.blitz"))).toBe(false);
  });
});
