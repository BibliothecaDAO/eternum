import { expect, it } from "vitest";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { type CoachArmy, type CoachTarget, coachSteps } from "./coach";

const army = (entityId: number, col: number, overrides: Partial<CoachArmy> = {}): CoachArmy => ({
  entityId,
  hex: { col, row: 0 },
  home: { realmId: 7, name: "Egonal", canLevelUp: true },
  canExplore: true,
  selected: false,
  ...overrides,
});
const target = (name: string, col: number): CoachTarget => ({
  kind: "site",
  name,
  hex: { col, row: 0 },
});
const troops = {
  realmId: 9,
  realmName: "'oak Leukue",
  stack: { type: TroopType.Knight, tier: TroopTier.T1, count: 1_000 },
};
const steps = (
  armies: CoachArmy[],
  targets: CoachTarget[] = [],
  state: Partial<Parameters<typeof coachSteps>[0]> = {},
) => coachSteps({ holds: true, armies, targets, troopsOnHand: troops, certainLoss: () => false, ...state });

it("raises the first army at the realm with troops on hand, or asks for a barracks when none has any", () => {
  expect(steps([], [target("Camp", 3)])).toEqual([
    {
      key: "coach:raise",
      line: "'oak Leukue: 1,000 troops ready",
      verb: "Raise an army",
      // Military opens on the stack the line names: its troop and its count.
      act: { kind: "raise", realmId: 9, troops: { type: TroopType.Knight, tier: TroopTier.T1, count: 1_000 } },
    },
  ]);
  expect(steps([], [], { troopsOnHand: null })).toEqual([
    {
      key: "coach:barracks",
      line: "No troops on hand",
      verb: "Build a barracks",
      act: { kind: "build" },
    },
  ]);
});

it("explores first, then goes for The Vanguard's nearest camp or rift", () => {
  const route = steps([army(1, 0)], [target("Rift", 9), target("Camp", 6)]);
  expect(route.map(({ line }) => line)).toEqual(["Your army can explore", "Take Camp from The Vanguard"]);
  expect(route[0].act).toEqual({ kind: "go", armyId: 1, target: null });
  expect(route[1].act).toEqual({ kind: "go", armyId: 1, target: { col: 6, row: 0 } });
});

it("moves on once the army is selected: the step says how to take it on the map, and a target's button still frames it", () => {
  const route = steps([army(1, 0, { selected: true })], [target("Camp", 4)]);
  expect(route).toEqual([
    {
      key: "coach:explore:1:selected",
      line: "Right-click a tile beside your army",
      verb: null,
      act: null,
    },
    {
      key: "coach:site:4:0:selected",
      line: "Move beside Camp, then right-click to attack",
      verb: "Show Camp",
      act: { kind: "go", armyId: 1, target: { col: 4, row: 0 } },
    },
  ]);
});

it("asks for the home realm's level-up before a target the army would surely lose to, and not before one it would not", () => {
  const rift = target("Rift", 3);
  const camp = target("Camp", 6);
  expect(steps([army(1, 0, { canExplore: false })], [rift], { certainLoss: (_army, at) => at === rift })).toEqual([
    {
      key: "coach:site:3:0:level-up",
      line: "Rift is too strong: level up Egonal",
      verb: null,
      act: { kind: "level-up", realmId: 7, name: "Egonal" },
    },
  ]);
  expect(steps([army(1, 0, { canExplore: false })], [camp], { certainLoss: (_army, at) => at === rift })).toEqual([
    {
      key: "coach:site:6:0",
      line: "Take Camp from The Vanguard",
      verb: "Show Camp",
      act: { kind: "go", armyId: 1, target: { col: 6, row: 0 } },
    },
  ]);
});

it("passes over a target the army would surely lose to once its home is at the top level", () => {
  const rift = target("Rift", 3);
  const camp = target("Camp", 6);
  const maxed = army(1, 0, { canExplore: false, home: { realmId: 7, name: "Egonal", canLevelUp: false } });
  expect(steps([maxed], [rift, camp], { certainLoss: (_army, at) => at === rift })).toEqual([
    {
      key: "coach:site:6:0",
      line: "Take Camp from The Vanguard",
      verb: "Show Camp",
      act: { kind: "go", armyId: 1, target: { col: 6, row: 0 } },
    },
  ]);
  const growing = army(2, 1, { canExplore: false, home: { realmId: 8, name: "Noyk", canLevelUp: true } });
  expect(steps([maxed, growing], [rift], { certainLoss: (_army, at) => at === rift }).map((step) => step.act)).toEqual([
    { kind: "level-up", realmId: 8, name: "Noyk" },
  ]);
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
