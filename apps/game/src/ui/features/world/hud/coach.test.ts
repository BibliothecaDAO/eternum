import { expect, it } from "vitest";
import { type CoachArmy, type CoachTarget, coachSteps } from "./coach";

const grants = { exploreTile: 5, openRelicCrate: 250, claimCampFromBandits: 250, claimHyperstructureFromBandits: 1000 };
const army = (entityId: number, col: number, overrides: Partial<CoachArmy> = {}): CoachArmy => ({
  entityId,
  hex: { col, row: 0 },
  home: { realmId: 7, name: "Egonal", canLevelUp: true },
  canExplore: true,
  selected: false,
  ...overrides,
});
const target = (kind: CoachTarget["kind"], name: string, col: number): CoachTarget => ({
  kind,
  name,
  hex: { col, row: 0 },
});
const troops = { realmId: 9, realmName: "'oak Leukue", troops: 1_000 };
const steps = (
  armies: CoachArmy[],
  targets: CoachTarget[] = [],
  state: Partial<Parameters<typeof coachSteps>[0]> = {},
) => coachSteps({ holds: true, armies, targets, troopsOnHand: troops, certainLoss: () => false, grants, ...state });

it("raises the first army at the realm with troops on hand, or asks for a barracks when none has any", () => {
  expect(steps([], [target("crate", "the relic crate", 3)])).toEqual([
    {
      key: "coach:raise",
      line: "Raise an army at 'oak Leukue (1,000 troops on hand): it explores for +5 points a tile.",
      verb: "Raise an army",
      act: { kind: "raise", realmId: 9 },
    },
  ]);
  expect(steps([], [], { troopsOnHand: null })).toEqual([
    {
      key: "coach:barracks",
      line: "No troops on hand: build a barracks to train them.",
      verb: "Build a barracks",
      act: { kind: "build" },
    },
  ]);
});

it("puts first what scores most now: a crate beside the army is opened from here, before exploring", () => {
  const route = steps(
    [army(1, 0)],
    [
      target("hyperstructure", "Obsidian Hyperstructure", 9),
      target("site", "Camp", 6),
      target("crate", "the relic crate", 1),
    ],
  );
  expect(route.map(({ line }) => line)).toEqual([
    "Your army is beside the relic crate: open it for +250 points.",
    "Your army can explore: +5 points a tile.",
    "Take Camp from The Vanguard: +250 points.",
    "Take Obsidian Hyperstructure: +1,000 points, then points every second.",
  ]);
  expect(route[0].act).toEqual({ kind: "open-crate", armyId: 1, hex: { col: 1, row: 0 } });
  expect(route[1].act).toEqual({ kind: "go", armyId: 1, target: null });
});

it("sends the nearest army to a crate farther off, and asks to explore only while an explore order would go", () => {
  const route = steps(
    [army(1, 0, { canExplore: false }), army(2, 10, { canExplore: false })],
    [target("crate", "the relic crate", 8)],
  );
  expect(route).toEqual([
    {
      key: "coach:crate:8:0",
      line: "Open the relic crate: +250 points.",
      verb: "Show the crate",
      act: { kind: "go", armyId: 2, target: { col: 8, row: 0 } },
    },
  ]);
});

it("moves on once the army is selected: the step says how to take it on the map, with no button", () => {
  const route = steps([army(1, 0, { selected: true })], [target("crate", "the relic crate", 4)]);
  expect(route).toEqual([
    {
      key: "coach:explore:1:selected",
      line: "Right-click a tile beside your army to explore it: +5 points a tile.",
      verb: null,
      act: null,
    },
    {
      key: "coach:crate:4:0:selected",
      line: "Move your army next to the relic crate, then right-click it: +250 points.",
      verb: null,
      act: null,
    },
  ]);
});

it("asks for the home realm's level-up before a target the army would surely lose to, and not before one it would not", () => {
  const hyperstructure = target("hyperstructure", "Obsidian Hyperstructure", 9);
  const camp = target("site", "Camp", 6);
  const route = steps([army(1, 0, { canExplore: false })], [hyperstructure, camp], {
    certainLoss: (_army, at) => at === hyperstructure,
  });
  expect(route).toEqual([
    {
      key: "coach:site:6:0",
      line: "Take Camp from The Vanguard: +250 points.",
      verb: "Show Camp",
      act: { kind: "go", armyId: 1, target: { col: 6, row: 0 } },
    },
    {
      key: "coach:hyperstructure:9:0:level-up",
      line: "Obsidian Hyperstructure would wipe out your army. Level up Egonal first: a bigger realm raises a bigger army.",
      verb: null,
      act: { kind: "level-up", realmId: 7, name: "Egonal" },
    },
  ]);
});

it("passes over a target the army would surely lose to once its home is at the top level", () => {
  const hyperstructure = target("hyperstructure", "Obsidian Hyperstructure", 9);
  const camp = target("site", "Camp", 6);
  const maxed = army(1, 0, { canExplore: false, home: { realmId: 7, name: "Egonal", canLevelUp: false } });
  expect(steps([maxed], [hyperstructure, camp], { certainLoss: (_army, at) => at === hyperstructure })).toEqual([
    {
      key: "coach:site:6:0",
      line: "Take Camp from The Vanguard: +250 points.",
      verb: "Show Camp",
      act: { kind: "go", armyId: 1, target: { col: 6, row: 0 } },
    },
  ]);
  // A second army, from a realm that can still rise, takes the level-up step for the Hyperstructure.
  const growing = army(2, 1, { canExplore: false, home: { realmId: 8, name: "Noyk", canLevelUp: true } });
  expect(
    steps([maxed, growing], [hyperstructure], { certainLoss: (_army, at) => at === hyperstructure }).map(
      (step) => step.act,
    ),
  ).toEqual([{ kind: "level-up", realmId: 8, name: "Noyk" }]);
});

it("asks nothing of a player who holds nothing to raise an army from", () => {
  expect(steps([], [], { holds: false, troopsOnHand: null })).toEqual([]);
});

it("sends the newest army that can explore, or the selected one when it can", () => {
  const explore = (armies: CoachArmy[]) => steps(armies).find(({ key }) => key.startsWith("coach:explore"));
  const stolsli = army(4, 0);
  const raisedLater = army(9, 3, { home: { realmId: 8, name: "Hetokamohuti", canLevelUp: true } });
  const resting = army(12, 5, { canExplore: false });

  expect(explore([stolsli, raisedLater, resting])?.act).toEqual({ kind: "go", armyId: 9, target: null });
  expect(explore([raisedLater, stolsli])?.act).toEqual({ kind: "go", armyId: 9, target: null });
  expect(explore([{ ...stolsli, selected: true }, raisedLater])?.key).toBe("coach:explore:4:selected");
  expect(explore([stolsli, raisedLater, { ...resting, selected: true }])?.act).toEqual({
    kind: "go",
    armyId: 9,
    target: null,
  });
});
