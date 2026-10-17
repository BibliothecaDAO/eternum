import { expect, it } from "vitest";
import { coachSteps, type CoachArmy, type CoachTarget } from "./coach";

const grants = { exploreTile: 5, openRelicCrate: 250, claimCampFromBandits: 250, claimHyperstructureFromBandits: 1000 };
const army = (entityId: number, col: number, canExplore: boolean): CoachArmy => ({
  entityId,
  hex: { col, row: 0 },
  canExplore,
});
const target = (kind: CoachTarget["kind"], name: string, col: number): CoachTarget => ({
  kind,
  name,
  hex: { col, row: 0 },
});
const steps = (armies: CoachArmy[], targets: CoachTarget[] = []) => coachSteps({ armies, targets, grants });

it("starts a player with no army in the field by raising one, and nothing else", () => {
  expect(steps([], [target("crate", "the relic crate", 3)])).toEqual([
    {
      key: "coach:raise",
      line: "Raise an army: it explores for +5 points a tile.",
      verb: "Raise an army",
      act: { kind: "raise" },
    },
  ]);
});

it("ranks the route by what scores: explore, then a crate, a camp or rift, a Hyperstructure", () => {
  const route = steps(
    [army(1, 0, true)],
    [
      target("hyperstructure", "Obsidian Hyperstructure", 9),
      target("site", "Camp", 6),
      target("crate", "the relic crate", 3),
    ],
  );
  expect(route.map(({ line }) => line)).toEqual([
    "Your army can explore: +5 points a tile.",
    "Open the relic crate: +250 points.",
    "Take Camp from The Vanguard: +250 points.",
    "Take Obsidian Hyperstructure: +1,000 points, then points every second.",
  ]);
  expect(route[0].act).toEqual({ kind: "go", armyId: 1, target: null });
  expect(route[1].act).toEqual({ kind: "go", armyId: 1, target: { col: 3, row: 0 } });
});

it("asks an army to explore only while an explore order would go, and sends the nearest army to each target", () => {
  const route = steps([army(1, 0, false), army(2, 10, false)], [target("crate", "the relic crate", 8)]);
  expect(route.map(({ key }) => key)).toEqual(["coach:crate:8:0"]);
  expect(route[0].act).toEqual({ kind: "go", armyId: 2, target: { col: 8, row: 0 } });
});
