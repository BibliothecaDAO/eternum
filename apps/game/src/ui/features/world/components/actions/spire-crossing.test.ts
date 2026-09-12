import { describe, expect, it } from "vitest";
import { resolveSpireCrossing } from "./spire-crossing";

describe("resolveSpireCrossing", () => {
  it("lets a surface army cross when its hex on the ethereal layer is free", () => {
    expect(resolveSpireCrossing(false, { occupier_id: 0, occupier_is_structure: false })).toEqual({
      kind: "clear",
      toEthereal: true,
    });
    expect(resolveSpireCrossing(false, undefined)).toEqual({ kind: "clear", toEthereal: true });
  });

  it("names what blocks the hex on the other side", () => {
    expect(resolveSpireCrossing(true, { occupier_id: 9, occupier_is_structure: false })).toEqual({
      kind: "blocked",
      toEthereal: false,
      by: "army",
    });
    expect(resolveSpireCrossing(false, { occupier_id: 4n, occupier_is_structure: true })).toEqual({
      kind: "blocked",
      toEthereal: true,
      by: "structure",
    });
  });
});
