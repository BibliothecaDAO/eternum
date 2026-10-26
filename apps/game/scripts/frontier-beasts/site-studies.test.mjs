import { it, expect } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import { SITE_STUDIES, MIST_STRESS_SITES, BEAST_STRESS_SITES } from "../../src/ui/features/debug/frontier-site-studies";
import {
  FRONTIER_BEASTS,
  FALLEN_REALM_RUIN_PATH,
  frontierSiteComposition,
} from "../../src/three/structures/frontier-beast";

it("shows the final map using production model paths and centered site compositions", () => {
  expect(SITE_STUDIES.map(({ id }) => id)).toEqual([
    "cyclops",
    "wraith",
    "troll",
    "dark-fey",
    "ammit",
    "basilisk",
    "wyvern",
    "hydra",
  ]);
  expect(SITE_STUDIES.map(({ parts }) => parts.length)).toEqual([1, 1, 1, 2, 2, 2, 2, 2]);
  const rift = frontierSiteComposition(StructureType.Rift);
  expect(SITE_STUDIES[3].parts).toEqual([
    { path: "/models/reward-tiles/rift.glb", scale: rift.baseScale },
    { path: FRONTIER_BEASTS["dark-fey"].path, scale: 0.75, y: rift.beastY },
  ]);
  expect(SITE_STUDIES.slice(4).map(({ parts }) => parts[0].path)).toEqual(Array(4).fill(FALLEN_REALM_RUIN_PATH));
});
it("stresses one hundred real ruin compositions, not stand-in geometry", () => {
  expect(MIST_STRESS_SITES).toHaveLength(100);
  expect(MIST_STRESS_SITES.every(({ parts }) => parts.length === 2 && parts[0].path === FALLEN_REALM_RUIN_PATH)).toBe(
    true,
  );
  expect(new Set(MIST_STRESS_SITES.map(({ position }) => JSON.stringify(position))).size).toBe(100);
});

it("stresses sixteen of every beast using the complete production compositions", () => {
  expect(BEAST_STRESS_SITES).toHaveLength(128);
  for (const { path } of Object.values(FRONTIER_BEASTS)) {
    expect(BEAST_STRESS_SITES.filter(({ parts }) => parts.some((part) => part.path === path))).toHaveLength(16);
  }
  expect(BEAST_STRESS_SITES.flatMap(({ parts }) => parts)).toHaveLength(208);
  expect(new Set(BEAST_STRESS_SITES.map(({ position }) => JSON.stringify(position))).size).toBe(128);
});
