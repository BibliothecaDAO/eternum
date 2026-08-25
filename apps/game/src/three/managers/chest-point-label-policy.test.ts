import { describe, expect, it } from "vitest";
import { resolveChestPointLabelSize } from "./chest-point-label-policy";

describe("resolveChestPointLabelSize", () => {
  it("keeps chest point-label icons aligned with the smaller map icon scale", () => {
    expect(resolveChestPointLabelSize()).toBe(40);
  });
});
