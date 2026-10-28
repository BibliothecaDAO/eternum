import { researchRowCategory } from "@bibliothecadao/eternum";
import { iconDefinition } from "@/ui/design-system/icon-meaning";
import { expect, it } from "vitest";

import { buildingIcon, buildingName } from "./building-names";

it("names and paints every building the contract's tree raises, so none reaches a card without its name or painting", () => {
  const buildings = Object.values(researchRowCategory).filter((category) => category !== undefined);
  expect(buildings.length).toBeGreaterThan(0);
  for (const category of buildings) {
    expect(buildingName(category), `building ${category}`).not.toBe("—");
    expect(() => iconDefinition(buildingIcon(category)), `building ${category}`).not.toThrow();
  }
});
