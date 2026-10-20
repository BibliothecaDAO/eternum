import { getHexDistance, formatCount, formatExact } from "@bibliothecadao/types";
import type { TroopStack } from "@/ui/features/military/components/unified-army-creation-modal/types";
import type { PointsGrants } from "./points-goal";

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

/** Something on the map that scores when an army takes it: a relic crate, a camp or rift, or a Hyperstructure. */
export interface CoachTarget {
  kind: "crate" | "site" | "hyperstructure";
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
  grants: PointsGrants;
}

/**
 * What a coach step does: raise an army at a realm, open Build to train troops, open a crate beside an army, level a
 * realm up, or select an army on the map with the card of the target it should go for open (none for exploring).
 */
export type CoachAct =
  | { kind: "raise"; realmId: number; troops: TroopStack }
  | { kind: "build" }
  | { kind: "open-crate"; armyId: number; hex: CoachHex }
  | { kind: "level-up"; realmId: number; name: string }
  | { kind: "go"; armyId: number; target: CoachHex | null };

/** A step: its line, and the verb that takes it; a step the player takes on the map itself has neither verb nor act. */
export interface CoachStep {
  key: string;
  line: string;
  verb: string | null;
  act: CoachAct | null;
}

/**
 * What scores most for the player right now, then what scores next. With no army in the field: raise one where troops
 * are on hand, or build a barracks; nothing for a player who holds nothing to build on. Then a crate an army stands
 * beside (+250, opened from here); an army that can explore (+5 a tile: the selected one, else the newest); a crate
 * farther off; The Vanguard's camps and rifts (+250) and Hyperstructures (+1,000, then points every second). A target
 * the nearest army would surely lose to asks for its home realm's level-up first, which raises bigger armies; one whose
 * home is at the top level is out of that army's reach. Once the army a step names is selected, the step says how to
 * take it on the map, and a target's button still frames it.
 */
export const coachSteps = (state: CoachState): CoachStep[] => {
  if (state.armies.length === 0) return state.holds ? [raiseStep(state)] : [];
  const besideCrate = nearest("crate", state, (pair) => pair.distance === 1);
  const explorer = armyToExplore(state.armies);
  return [
    ...(besideCrate ? [openCrateStep(besideCrate, state.grants)] : []),
    ...(explorer ? [exploreStep(explorer, state.grants)] : []),
    ...goFor("crate", state, (pair) => pair.distance > 1),
    ...goFor("site", state),
    ...goFor("hyperstructure", state),
  ];
};

/** An army to raise: at the realm with the most troops on hand, or, with none anywhere, a barracks to build first. */
export const raiseStep = ({ troopsOnHand, grants }: Pick<CoachState, "troopsOnHand" | "grants">): CoachStep =>
  troopsOnHand
    ? {
        key: "coach:raise",
        line: `Raise an army at ${troopsOnHand.realmName} (${formatCount(troopsOnHand.stack.count, "troop")} on hand): it explores for +${formatExact(grants.exploreTile)} points a tile.`,
        verb: "Raise an army",
        act: { kind: "raise", realmId: troopsOnHand.realmId, troops: troopsOnHand.stack },
      }
    : {
        key: "coach:barracks",
        line: "No troops on hand: build a barracks to train them.",
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

const openCrateStep = ({ army, target }: Pair, grants: PointsGrants): CoachStep => ({
  key: `coach:open-crate:${target.hex.col}:${target.hex.row}`,
  line: `Your army is beside ${target.name}: open it for +${formatExact(grants.openRelicCrate)} points.`,
  verb: "Open the crate",
  act: { kind: "open-crate", armyId: army.entityId, hex: target.hex },
});

const exploreStep = (army: CoachArmy, grants: PointsGrants): CoachStep => {
  const points = `+${formatExact(grants.exploreTile)} points a tile`;
  return army.selected
    ? {
        key: `coach:explore:${army.entityId}:selected`,
        line: `Click a tile beside your army to explore it: ${points}.`,
        verb: null,
        act: null,
      }
    : {
        key: `coach:explore:${army.entityId}`,
        line: `Your army can explore: ${points}.`,
        verb: "Select the army",
        act: { kind: "go", armyId: army.entityId, target: null },
      };
};

type Pair = { target: CoachTarget; army: CoachArmy; distance: number };

/** The nearest target of a kind to any of the armies, among the pairs `admits` lets through. */
const nearest = (
  kind: CoachTarget["kind"],
  { armies, targets }: CoachState,
  admits: (pair: Pair) => boolean = () => true,
): Pair | null =>
  targets
    .filter((target) => target.kind === kind)
    .flatMap((target) => armies.map((army) => ({ target, army, distance: distance(army.hex, target.hex) })))
    .filter(admits)
    .reduce<Pair | null>((best, pair) => (best === null || pair.distance < best.distance ? pair : best), null);

/**
 * The nearest target of a kind, as a step that selects that army with the target's card open; once that army is
 * selected, the step says how to take it on the map and its button still frames the target with the army. A camp, rift
 * or Hyperstructure the army would surely lose to asks for its home realm's level-up first.
 */
const goFor = (
  kind: CoachTarget["kind"],
  state: CoachState,
  admits: (pair: Pair) => boolean = () => true,
): CoachStep[] => {
  const pair = nearest(kind, state, (candidate) => admits(candidate) && !isOutOfReach(candidate, state));
  if (!pair) return [];
  const { army, target } = pair;
  const key = `coach:${kind}:${target.hex.col}:${target.hex.row}`;
  if (kind !== "crate" && state.certainLoss(army, target)) {
    return [
      {
        key: `${key}:level-up`,
        line: `${target.name} would wipe out your army. Level up ${army.home.name} first: a bigger realm raises a bigger army.`,
        verb: null,
        act: { kind: "level-up", realmId: army.home.realmId, name: army.home.name },
      },
    ];
  }
  const words = goWords(kind, target.name, state.grants);
  // The target is often in the fog, far off: its button frames it with the army, also once the army is selected.
  const go: CoachAct = { kind: "go", armyId: army.entityId, target: target.hex };
  return [
    army.selected
      ? { key: `${key}:selected`, line: words.onMap, verb: words.verb, act: go }
      : { key, line: words.line, verb: words.verb, act: go },
  ];
};

/** The army would surely lose to the target, and its home is at the top level: no level-up raises a bigger one. */
const isOutOfReach = ({ army, target }: Pair, state: CoachState): boolean =>
  !army.home.canLevelUp && target.kind !== "crate" && state.certainLoss(army, target);

/** A target's line, its button's verb, and the line once its army is selected: how to take it on the map. */
const goWords = (kind: CoachTarget["kind"], name: string, grants: PointsGrants) => {
  if (kind === "crate") {
    const points = `+${formatExact(grants.openRelicCrate)} points`;
    return {
      line: `Open ${name}: ${points}.`,
      verb: "Show the crate",
      onMap: `Move your army next to ${name}, then right-click it: ${points}.`,
    };
  }
  const [line, points] =
    kind === "site"
      ? [`Take ${name} from The Vanguard`, `+${formatExact(grants.claimCampFromBandits)} points`]
      : [`Take ${name}`, `+${formatExact(grants.claimHyperstructureFromBandits)} points, then points every second`];
  return {
    line: `${line}: ${points}.`,
    verb: `Show ${name}`,
    onMap: `Move your army next to ${name}, then right-click it to attack: ${points}.`,
  };
};

const distance = (from: CoachHex, to: CoachHex): number => getHexDistance(from, to, Number.POSITIVE_INFINITY);
