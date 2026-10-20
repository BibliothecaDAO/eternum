import { it, expect } from "vitest";
import { SITE_STUDIES, SURFACE_STUDY_SCALE } from "../../src/ui/features/debug/frontier-site-studies";
import {
  FALLEN_REALM_DEPTHS,
  FRONTIER_BEASTS,
  FALLEN_REALM_RUIN_PATH,
} from "../../src/three/structures/frontier-beast";
import { measureBeastPlacement } from "../frontier/verify-beast-placement.mjs";

it("shows the owner's encounter map without changing the deeper ruin compositions", () => {
  expect(
    SITE_STUDIES.filter(({ id }) => ["ghoul", "kappa", "wraith"].includes(id)).map(({ parts }) => parts.length),
  ).toEqual([1, 1, 1]);
  expect(SITE_STUDIES.find(({ id }) => id === "troll").parts).toEqual([
    { path: FRONTIER_BEASTS.troll.path, scale: 0.85 },
  ]);
  expect(SITE_STUDIES.find(({ id }) => id === "cyclops").parts).toEqual([
    { path: FRONTIER_BEASTS.cyclops.path, scale: 1 },
  ]);
  expect(SITE_STUDIES.find(({ id }) => id === "dark-fey").parts.map(({ path }) => path)).toEqual([
    "/models/reward-tiles/rift.glb",
    "/lab/frontier-beasts/beast-dark-fey.glb",
  ]);
  for (const [i, { beast, scale }] of FALLEN_REALM_DEPTHS.slice(1).entries()) {
    expect(SITE_STUDIES.find(({ id }) => id === `ruin-${i + 1}`).parts).toEqual([
      { path: FALLEN_REALM_RUIN_PATH, scale: 1 },
      { path: FRONTIER_BEASTS[beast].path, scale },
    ]);
  }
});

for (const species of ["basilisk", "ammit"]) {
  it(`${species}: the surface study fits the unchanged ruin courtyard`, async () => {
    const ruin = new URL(`../../public${FALLEN_REALM_RUIN_PATH}`, import.meta.url).pathname;
    const beast = new URL(`../../asset-sources/lab/frontier-beasts/beast-${species}.glb`, import.meta.url).pathname;
    const result = await measureBeastPlacement(species, SURFACE_STUDY_SCALE, ruin, beast);
    console.log(JSON.stringify(result));
    expect(result.fitsTile).toBe(true);
    expect(result.masonryContacts).toBe(0);
  });
}
