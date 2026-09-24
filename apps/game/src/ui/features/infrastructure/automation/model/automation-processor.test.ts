// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { buildAutomationSkipMessage } from "@bibliothecadao/eternum/automation";

describe("buildAutomationSkipMessage", () => {
  it("describes inactive production buildings with the resource name", () => {
    expect(
      buildAutomationSkipMessage({
        resourceId: ResourcesIds.PaladinT2,
        reason: "No active production building",
      }),
    ).toBe("PaladinT2 has no active production building");
  });

  it("describes troop input waits with the resource name", () => {
    expect(
      buildAutomationSkipMessage({
        resourceId: ResourcesIds.KnightT2,
        reason: "Insufficient complex recipe inputs",
      }),
    ).toBe("KnightT2 waiting for recipe inputs");
  });
});
