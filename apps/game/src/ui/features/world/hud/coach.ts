import { getHexDistance, formatCount } from "@bibliothecadao/types";
import type { TroopStack } from "@/ui/features/military/components/unified-army-creation-modal/types";

/** A hex in contract space, as the map and its facts give it. */
export interface CoachHex {
  col: number;
  row: number;
}

/** One of the player's armies in the field: where it stands, its home realm, and what it can do now. */
export interface CoachArmy {
  entityId: number;
  hex: CoachHex;
  /** The realm it was raised from, whose level bounds how big an army it can raise, and whether it can rise further. */
  home: { realmId: number; name: string; canLevelUp: boolean };
  /** An explore order would go now (the order's own rule: stamina and the home's food). */
  canExplore: boolean;
  /** It is the army selected on the map. */
  selected: boolean;
}

export interface CoachTarget {
  kind: "site";
  name: string;
  hex: CoachHex;
}

/** The player's realm with the largest troop stack on hand, where an army can be raised now, and that stack. */
export interface TroopsOnHand {
  realmId: number;
  realmName: string;
  stack: TroopStack;
}

/** What the coach reads: the player's armies and troops, what scores on the map, and the game's rules. */
interface CoachState {
  /** The player holds a realm or another structure, where an army can be raised. */
  holds: boolean;
  armies: readonly CoachArmy[];
  targets: readonly CoachTarget[];
  /** Null when no realm holds a troop. */
  troopsOnHand: TroopsOnHand | null;
  /** The army is wiped out at any roll attacking the target's guards as they stand. */
  certainLoss: (army: CoachArmy, target: CoachTarget) => boolean;
}

export type CoachAct =
  | { kind: "raise"; realmId: number; troops: TroopStack }
  | { kind: "build" }
  | { kind: "level-up"; realmId: number; name: string }
  | { kind: "go"; armyId: number; target: CoachHex | null };

/** A step: its line, and the verb that takes it; a step the player takes on the map itself has neither verb nor act. */
export interface CoachStep {
  key: string;
  line: string;
  verb: string | null;
  act: CoachAct | null;
}

export const coachSteps = (state: CoachState): CoachStep[] => {
  if (state.armies.length === 0) return state.holds ? [raiseStep(state)] : [];
  const explorer = armyToExplore(state.armies);
  return [...(explorer ? [exploreStep(explorer)] : []), ...goForSite(state)];
};

/** An army to raise: at the realm with the most troops on hand, or, with none anywhere, a barracks to build first. */
export const raiseStep = ({ troopsOnHand }: Pick<CoachState, "troopsOnHand">): CoachStep =>
  troopsOnHand
    ? {
        key: "coach:raise",
        line: `${troopsOnHand.realmName}: ${formatCount(troopsOnHand.stack.count, "troop")} ready`,
        verb: "Raise an army",
        act: { kind: "raise", realmId: troopsOnHand.realmId, troops: troopsOnHand.stack },
      }
    : {
        key: "coach:barracks",
        line: "No troops on hand",
        verb: "Build a barracks",
        act: { kind: "build" },
      };

/**
 * The army Next up sends exploring: the selected one when it can, else the newest that can (entity ids rise as armies
 * are raised), the one the player most likely just raised for it.
 */
const armyToExplore = (armies: readonly CoachArmy[]): CoachArmy | undefined => {
  const able = armies.filter((army) => army.canExplore);
  return able.find((army) => army.selected) ?? able.toSorted((left, right) => right.entityId - left.entityId)[0];
};

const exploreStep = (army: CoachArmy): CoachStep =>
  army.selected
    ? {
        key: `coach:explore:${army.entityId}:selected`,
        line: "Right-click a tile beside your army",
        verb: null,
        act: null,
      }
    : {
        key: `coach:explore:${army.entityId}`,
        line: "Your army can explore",
        verb: "Select the army",
        act: { kind: "go", armyId: army.entityId, target: null },
      };

type Pair = { target: CoachTarget; army: CoachArmy; distance: number };

const nearest = ({ armies, targets }: CoachState, admits: (pair: Pair) => boolean): Pair | null =>
  targets
    .flatMap((target) => armies.map((army) => ({ target, army, distance: distance(army.hex, target.hex) })))
    .filter(admits)
    .reduce<Pair | null>((best, pair) => (best === null || pair.distance < best.distance ? pair : best), null);

const goForSite = (state: CoachState): CoachStep[] => {
  const pair = nearest(state, (candidate) => !isOutOfReach(candidate, state));
  if (!pair) return [];
  const { army, target } = pair;
  const key = `coach:site:${target.hex.col}:${target.hex.row}`;
  if (state.certainLoss(army, target)) {
    return [
      {
        key: `${key}:level-up`,
        line: `${target.name} is too strong: level up ${army.home.name}`,
        verb: null,
        act: { kind: "level-up", realmId: army.home.realmId, name: army.home.name },
      },
    ];
  }
  const go: CoachAct = { kind: "go", armyId: army.entityId, target: target.hex };
  const verb = `Show ${target.name}`;
  return [
    army.selected
      ? { key: `${key}:selected`, line: `Move beside ${target.name}, then right-click to attack`, verb, act: go }
      : {
          key,
          line: `Take ${target.name} from The Vanguard`,
          verb,
          act: go,
        },
  ];
};

/** The army would surely lose to the target, and its home is at the top level: no level-up raises a bigger one. */
const isOutOfReach = ({ army, target }: Pair, state: CoachState): boolean =>
  !army.home.canLevelUp && state.certainLoss(army, target);

const distance = (from: CoachHex, to: CoachHex): number => getHexDistance(from, to, Number.POSITIVE_INFINITY);
