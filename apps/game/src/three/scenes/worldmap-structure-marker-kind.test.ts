import { StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { structureMarkerKind } from "./worldmap-structure-marker-kind";

afterEach(() => vi.restoreAllMocks());

describe("the far view's marker for a structure", () => {
  it("is the category's own for every category this build knows", () => {
    expect(structureMarkerKind(StructureType.Realm)).toBe("realm");
    expect(structureMarkerKind(StructureType.Rift)).toBe("mine");
    expect(structureMarkerKind(StructureType.Hyperstructure)).toBe("hyperstructure");
  });

  it("is the plainest marker for a category the build does not know, said once and loudly", () => {
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    const unknown = 250 as StructureType;
    expect(structureMarkerKind(unknown)).toBe("village");
    expect(structureMarkerKind(unknown)).toBe("village");
    expect(reported).toHaveBeenCalledOnce();
    expect(String(reported.mock.calls[0][0])).toContain("250");
  });
});
