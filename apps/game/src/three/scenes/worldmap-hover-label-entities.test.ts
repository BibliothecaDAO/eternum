import { describe, expect, it } from "vitest";

import { resolveWorldmapHoverLabelEntity } from "./worldmap-hover-label-entities";

describe("resolveWorldmapHoverLabelEntity", () => {
  it("returns only the id for raycast fallback targets without cached entity data", () => {
    const entity = resolveWorldmapHoverLabelEntity(42);

    expect(entity).toEqual({ id: 42 });
    expect(entity).not.toHaveProperty("owner");
  });

  it("preserves cached entity metadata when the target id matches", () => {
    const cachedEntity = { id: 42, owner: 7n };

    expect(resolveWorldmapHoverLabelEntity(42, cachedEntity)).toBe(cachedEntity);
  });
});
