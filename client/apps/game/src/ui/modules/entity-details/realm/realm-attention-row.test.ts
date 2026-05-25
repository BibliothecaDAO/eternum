// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { buildStarvingResourceAttentionLabel } from "./realm-attention-row";

describe("buildStarvingResourceAttentionLabel", () => {
  it("turns troop shorthand and hidden skip reasons into readable chip copy", () => {
    expect(buildStarvingResourceAttentionLabel(ResourcesIds.KnightT2, "KnightT2 waiting for recipe inputs")).toBe(
      "Knight T2 waiting for inputs",
    );
  });

  it("keeps the reason visible for inactive production buildings", () => {
    expect(
      buildStarvingResourceAttentionLabel(ResourcesIds.PaladinT2, "PaladinT2 has no active production building"),
    ).toBe("Paladin T2 needs an active producer");
  });
});
