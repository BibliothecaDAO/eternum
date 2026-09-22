import { describe, expect, test } from "bun:test";
import { resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("resolves the Madara Blitz balance environment", () => {
    const environment = resolveDeploymentEnvironment("madara.blitz");

    expect(environment.chain).toBe("madara");
    expect(environment.gameType).toBe("blitz");
    expect(environment.accountAddress).toBeUndefined();
    expect(environment.privateKey).toBeUndefined();
    expect(environment.configPath).toBe("config/generated/blitz.madara.json");
  });

  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("invalid.blitz")).toThrow(
      'Unsupported environment "invalid.blitz". Expected one of: madara.blitz',
    );
  });
});
