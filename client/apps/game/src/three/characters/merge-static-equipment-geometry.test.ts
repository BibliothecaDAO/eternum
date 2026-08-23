import { BoxGeometry, Matrix4 } from "three";
import { describe, expect, it } from "vitest";

import { mergeStaticEquipmentGeometry } from "./merge-static-equipment-geometry";

describe("mergeStaticEquipmentGeometry", () => {
  it("bakes transforms into one reusable geometry without mutating sources", () => {
    const source = new BoxGeometry(1, 1, 1);
    const merged = mergeStaticEquipmentGeometry([
      { geometry: source, transform: new Matrix4().makeTranslation(-1, 0, 0) },
      { geometry: source, transform: new Matrix4().makeTranslation(1, 0, 0) },
    ]);

    expect(source.boundingBox).toBeNull();
    expect(merged.boundingBox?.min.x).toBeCloseTo(-1.5);
    expect(merged.boundingBox?.max.x).toBeCloseTo(1.5);
    expect(merged.getAttribute("position").count).toBe(source.getAttribute("position").count * 2);
    source.dispose();
    merged.dispose();
  });
});
