import { describe, expect, test } from "bun:test";
import { isEternumDeploymentEnvironment, resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("resolves the madara registrar from its deployment manifest", () => {
    const environment = resolveDeploymentEnvironment("madara.blitz");

    expect(environment.chain).toBe("madara");
    expect(environment.gameType).toBe("blitz");
    expect(environment.accountAddress).toBeUndefined();
    expect(environment.privateKey).toBeUndefined();
    expect(environment.world).toEqual({
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_madara.json",
    });
  });

  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("invalid.blitz")).toThrow(
      'Unsupported environment "invalid.blitz". Expected one of: madara.blitz',
    );
  });

  test("keeps eternum-only launch gates separate from blitz", () => {
    expect(isEternumDeploymentEnvironment(resolveDeploymentEnvironment("madara.blitz"))).toBe(false);
  });
});
