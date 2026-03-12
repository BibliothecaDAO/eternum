import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SceneName } from "../types";
import {
  resolveEnterFastTravelTransition,
  resolveExitFastTravelTransition,
} from "./fast-travel-navigation-policy";
import { resolveFastTravelSpireByTravelHex, resolveFastTravelSpireByWorldHex } from "./fast-travel-spire-mapping";

function readNavigationSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const navigationPath = resolve(currentDir, "../utils/navigation.ts");
  return readFileSync(navigationPath, "utf8");
}

const spireMappings = [
  {
    entityId: "spire-1",
    label: "North Spire",
    worldHexCoords: { col: 400, row: 120 },
    travelHexCoords: { col: 12, row: 11 },
  },
  {
    entityId: "spire-2",
    label: "South Spire",
    worldHexCoords: { col: 520, row: 240 },
    travelHexCoords: { col: 41, row: 38 },
  },
] as const;

describe("fast-travel Spire navigation policy", () => {
  it("maps world-map Spire entry to the fast-travel destination", () => {
    expect(
      resolveFastTravelSpireByWorldHex({
        worldHexCoords: { col: 400, row: 120 },
        spireMappings,
      }),
    ).toEqual(spireMappings[0]);

    expect(
      resolveEnterFastTravelTransition({
        worldHexCoords: { col: 400, row: 120 },
        spireMappings,
      }),
    ).toEqual({
      scene: SceneName.FastTravel,
      col: 12,
      row: 11,
      spireId: "spire-1",
    });
  });

  it("maps fast-travel exits back to the correct world-map Spire", () => {
    expect(
      resolveFastTravelSpireByTravelHex({
        travelHexCoords: { col: 41, row: 38 },
        spireMappings,
      }),
    ).toEqual(spireMappings[1]);

    expect(
      resolveExitFastTravelTransition({
        travelHexCoords: { col: 41, row: 38 },
        spireMappings,
      }),
    ).toEqual({
      scene: SceneName.WorldMap,
      col: 520,
      row: 240,
      spireId: "spire-2",
    });
  });

  it("leaves non-Spire world-map navigation unchanged", () => {
    expect(
      resolveFastTravelSpireByWorldHex({
        worldHexCoords: { col: 401, row: 120 },
        spireMappings,
      }),
    ).toBeNull();

    expect(
      resolveEnterFastTravelTransition({
        worldHexCoords: { col: 401, row: 120 },
        spireMappings,
      }),
    ).toBeNull();
  });

  it("adds dedicated travel entry and exit navigation helpers", () => {
    const source = readNavigationSource();

    expect(source).toMatch(/navigateIntoFastTravelSpire/);
    expect(source).toMatch(/navigateOutOfFastTravelSpire/);
    expect(source).toMatch(/SceneName\.FastTravel/);
  });
});
