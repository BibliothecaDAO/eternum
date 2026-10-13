import { StructureType } from "@bibliothecadao/types";
import { afterEach, expect, it, vi } from "vitest";

import { byStructureCategory } from "./structure-category-table";

const NAMES = Object.fromEntries(
  Object.values(StructureType)
    .filter((category): category is StructureType => typeof category === "number")
    .map((category) => [category, StructureType[category]]),
) as Record<StructureType, string>;

afterEach(() => vi.restoreAllMocks());

it("answers a known category from the table, and a category the build does not know loudly, once", () => {
  const reported = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(byStructureCategory(NAMES, StructureType.Rift, "name", "Structure")).toBe("Rift");
  expect(reported).not.toHaveBeenCalled();

  expect(byStructureCategory(NAMES, 250, "name", "Structure")).toBe("Structure");
  expect(byStructureCategory(NAMES, 250, "name", "Structure")).toBe("Structure");
  expect(reported).toHaveBeenCalledOnce();
  expect(String(reported.mock.calls[0][0])).toContain("name for structure category 250");
});
