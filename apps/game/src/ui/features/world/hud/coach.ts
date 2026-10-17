import { getHexDistance } from "@bibliothecadao/types";
import type { PointsGrants } from "./points-goal";

/** A hex in contract space, as the map and its facts give it. */
export interface CoachHex {
  col: number;
  row: number;
}

/** One of the player's armies in the field: where it stands, and whether an explore order would go now. */
export interface CoachArmy {
  entityId: number;
  hex: CoachHex;
  canExplore: boolean;
}

/** Something on the map that scores when an army takes it: a relic crate, a camp or rift, or a Hyperstructure. */
export interface CoachTarget {
  kind: "crate" | "site" | "hyperstructure";
  name: string;
  hex: CoachHex;
}

/** What the coach reads: the player's armies, what scores on the map, and the game's rules. */
interface CoachState {
  armies: readonly CoachArmy[];
  targets: readonly CoachTarget[];
  grants: PointsGrants;
}

/**
 * What a coach step does: open Military to raise an army, or select an army on the map, with the card of the target
 * it should go for open (none for exploring).
 */
export type CoachAct = { kind: "raise" } | { kind: "go"; armyId: number; target: CoachHex | null };

export interface CoachStep {
  key: string;
  line: string;
  verb: string;
  act: CoachAct;
}

/**
 * The first session's route, ranked by what scores: raise an army; explore with it (+5 a tile); open a crate (+250);
 * take a camp or rift from The Vanguard (+250); take a Hyperstructure (+1,000, then points every second). Each step
 * holds while the game state offers it, so a lost army brings back "Raise an army", and a step the map does not offer
 * yet (no crate in sight) is left out.
 */
export const coachSteps = ({ armies, targets, grants }: CoachState): CoachStep[] => {
  if (armies.length === 0) {
    return [
      {
        key: "coach:raise",
        line: `Raise an army: it explores for +${grants.exploreTile.toLocaleString()} points a tile.`,
        verb: "Raise an army",
        act: { kind: "raise" },
      },
    ];
  }
  const explorer = armies.find((army) => army.canExplore);
  const steps: CoachStep[] = explorer
    ? [
        {
          key: `coach:explore:${explorer.entityId}`,
          line: `Your army can explore: +${grants.exploreTile.toLocaleString()} points a tile.`,
          verb: "Select the army",
          act: { kind: "go", armyId: explorer.entityId, target: null },
        },
      ]
    : [];
  return [
    ...steps,
    ...goFor("crate", armies, targets, (name) => [
      `Open ${name}: +${grants.openRelicCrate.toLocaleString()} points.`,
      "Show the crate",
    ]),
    ...goFor("site", armies, targets, (name) => [
      `Take ${name} from The Vanguard: +${grants.claimCampFromBandits.toLocaleString()} points.`,
      `Show ${name}`,
    ]),
    ...goFor("hyperstructure", armies, targets, (name) => [
      `Take ${name}: +${grants.claimHyperstructureFromBandits.toLocaleString()} points, then points every second.`,
      `Show ${name}`,
    ]),
  ];
};

/** The nearest target of a kind to any of the armies, as a step that selects that army with the target's card open. */
const goFor = (
  kind: CoachTarget["kind"],
  armies: readonly CoachArmy[],
  targets: readonly CoachTarget[],
  words: (name: string) => [line: string, verb: string],
): CoachStep[] => {
  const nearest = targets
    .filter((target) => target.kind === kind)
    .flatMap((target) => armies.map((army) => ({ target, army, distance: distance(army.hex, target.hex) })))
    .reduce<{ target: CoachTarget; army: CoachArmy; distance: number } | null>(
      (best, pair) => (best === null || pair.distance < best.distance ? pair : best),
      null,
    );
  if (!nearest) return [];
  const [line, verb] = words(nearest.target.name);
  return [
    {
      key: `coach:${kind}:${nearest.target.hex.col}:${nearest.target.hex.row}`,
      line,
      verb,
      act: { kind: "go", armyId: nearest.army.entityId, target: nearest.target.hex },
    },
  ];
};

const distance = (from: CoachHex, to: CoachHex): number => getHexDistance(from, to, Number.POSITIVE_INFINITY);
