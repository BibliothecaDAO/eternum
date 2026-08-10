import { describe, expect, test } from "bun:test";
import { DEFAULT_APPCHAIN_RPC_URL } from "../constants";
import { isEternumDeploymentEnvironment, resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("accepts appchain.blitz", () => {
    const environment = resolveDeploymentEnvironment("appchain.blitz");
    expect(environment.chain).toBe("appchain");
    expect(environment.gameType).toBe("blitz");
    expect(environment.factoryAddress).toBeUndefined();
    expect(environment.rpcUrl).toBe(DEFAULT_APPCHAIN_RPC_URL);
    expect(environment.accountAddress).toBeUndefined();
    expect(environment.privateKey).toBeUndefined();
    expect(environment.appchainWorld).toEqual({
      namespace: "s2",
      manifestPath: "contracts/game/manifest_appchain_blitz.json",
      registrarAddress: "0x51b8a03d3d65bb44f41d0415a99987c128252a78e25f9c136a9dcbd79650068",
    });
    expect(environment.createGame).toEqual({
      maxActions: 20,
      submissionCount: 15,
      retryCount: 5,
      retryDelayMs: 10000,
    });
  });

  test("resolves the eternum appchain manifest independently", () => {
    const environment = resolveDeploymentEnvironment("appchain.eternum");

    expect(environment.appchainWorld).toEqual({
      namespace: "s2",
      manifestPath: "contracts/game/manifest_appchain_eternum.json",
      registrarAddress: "0x0",
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
      maxActions: 50,
      submissionCount: 3,
      retryCount: 5,
      retryDelayMs: 10000,
    });
  });

  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("invalid.blitz")).toThrow(
      'Unsupported environment "invalid.blitz". Expected one of: mainnet.blitz, mainnet.eternum, appchain.blitz, appchain.eternum',
    );
  });

  test("keeps eternum-only launch gates separate from blitz", () => {
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("appchain.eternum"))).toBe(true);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("appchain.blitz"))).toBe(false);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("mainnet.eternum"))).toBe(true);
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("mainnet.blitz"))).toBe(false);
  });
});
