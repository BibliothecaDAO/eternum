import { describe, expect, test } from "bun:test";
import { resolveDeploymentEnvironment } from "../environment";

describe("resolveDeploymentEnvironment", () => {
  test("rejects unsupported environments", () => {
    expect(() => resolveDeploymentEnvironment("invalid.blitz")).toThrow(
      'Unsupported environment "invalid.blitz". Expected one of: madara.blitz',
    );
  });
});
