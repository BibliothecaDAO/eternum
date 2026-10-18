import { formatDuration, formatExact } from "@bibliothecadao/types";
import { ARRIVING, GUARD, UNDEFENDED } from "@/ui/design-system/kit/words";

import {
  attackOrder,
  restingGuard,
  type ArmyPlate,
  type MapPlate,
  type PlateTroops,
  type StructurePlate,
} from "./map-plate-model";

/**
 * One reading on a plate, in the HUD panel's voice: a player in the side's colour, a place's own name as a title, a
 * kind in plain words, a label (a reward, a state, what a number counts) in the panel's label colour, a time as its
 * cue, a count in white, a troop stack as its painting, tier chip and count, an army's stamina as its bar and "x/y".
 */
export type PlateSegment =
  | { kind: "owner"; text: string }
  | { kind: "title"; text: string }
  | { kind: "word"; text: string }
  | { kind: "label"; text: string }
  | { kind: "cue"; text: string }
  | { kind: "count"; text: string }
  | { kind: "troops"; troops: PlateTroops }
  | { kind: "stamina"; current: number; max: number }
  /** Between the guard slots, in the order an attacker meets them. */
  | { kind: "next" }
  /** Between two readings on one row: a player and their realm ("clientlane | Stolsli"), a guard and what is beside it. */
  | { kind: "divider" };

type PlateRow = readonly PlateSegment[];

/**
 * What a plate says, row by row (the owner's rounds 5 and 6 of the map labels, the sheet's round 3): at rest two short
 * rows, opened (its tile hovered, or selected) at most three, from the most important fact down. No id anywhere.
 *
 * - An army: its player, then its troops, a tight stamina bar under them (`restingStamina`). Opened: the realm it
 *   comes from joins the player as on that realm's plate ("clientlane | Stolsli"), and its stamina keeps its own row
 *   under the troops, the bar with its exact "84/150" (owner, map labels 2026-10-18).
 * - A realm or a hyperstructure: its player and its name, then its guard. Opened: the guard slots in attack order, and
 *   a row of troops on their way, each time before its troops.
 * - A camp or a rift: its lore name, then its guard. Opened: its owner, its name and kind, and what it holds beside its
 *   guard.
 */
export const plateRows = (plate: MapPlate, open: boolean): PlateRow[] =>
  plate.kind === "army" ? armyRows(plate, open) : plate.named ? placeRows(plate, open) : siteRows(plate, open);

/**
 * An army at rest: how full its stamina is (0 to 1), drawn as a tight bar under its troops, with no number (owner,
 * sheet round 5); opened, its stamina is a reading with its exact "x/y". None for anything else, or unknown stamina.
 */
export const restingStamina = (plate: MapPlate, open: boolean): number | null =>
  plate.kind === "army" && !open && plate.stamina ? plate.stamina.current / plate.stamina.max : null;

const armyRows = (plate: ArmyPlate, open: boolean): PlateRow[] =>
  open
    ? [
        whose(plate.owner, plate.homeName),
        [{ kind: "troops", troops: plate.troops }],
        ...(plate.stamina ? [[{ kind: "stamina", ...plate.stamina } as const]] : []),
      ]
    : [[{ kind: "owner", text: plate.owner }], [{ kind: "troops", troops: plate.troops }]];

const placeRows = (plate: StructurePlate, open: boolean): PlateRow[] => {
  const rows: PlateRow[] = [whose(plate.owner, plate.name), guard(plate.guards, open)];
  if (open && plate.arrivals.length > 0) rows.push(arrivals(plate));
  return rows;
};

const siteRows = (plate: StructurePlate, open: boolean): PlateRow[] => {
  const name: PlateSegment = plate.place ? { kind: "title", text: plate.place } : { kind: "word", text: plate.name };
  if (!open) return [[name], guard(plate.guards, false)];
  // Three rows at most: what it holds, and troops on their way to one of the player's own sites, follow its guard.
  const holds = plate.reward ? [{ kind: "divider" } as const, { kind: "label", text: plate.reward } as const] : [];
  const arriving = plate.arrivals.length > 0 ? [{ kind: "divider" } as const, ...arrivals(plate)] : [];
  return [
    [{ kind: "owner", text: plate.owner }],
    plate.place ? [name, { kind: "word", text: plate.name }] : [name],
    [...guard(plate.guards, true), ...holds, ...arriving],
  ];
};

/**
 * A player and their realm, the same on a realm's plate and on an army's from it: "clientlane | Stolsli". A realm not
 * known leaves the player alone, never an empty name.
 */
const whose = (owner: string, realm: string): PlateRow => [
  { kind: "owner", text: owner },
  ...(realm ? [{ kind: "divider" } as const, { kind: "title", text: realm } as const] : []),
];

/**
 * A guard: none, "Undefended"; at rest one number (a single slot as its troop stack, several as their total, "1,731
 * guard"); opened, every slot in the order an attacker meets them.
 */
const guard = (guards: readonly PlateTroops[], open: boolean): PlateSegment[] => {
  const resting = restingGuard(guards);
  if (resting.kind === "open") return [{ kind: "label", text: UNDEFENDED }];
  if (resting.kind === "slot") return [{ kind: "troops", troops: resting.slot }];
  if (!open)
    return [
      { kind: "count", text: formatExact(resting.total) },
      { kind: "label", text: GUARD },
    ];
  return attackOrder(guards).flatMap((slot, index) => [
    ...(index > 0 ? [{ kind: "next" } as const] : []),
    { kind: "troops", troops: slot } as const,
  ]);
};

/** Troops on their way, each when it arrives and then what arrives: "Arriving 13m T2 300". */
const arrivals = (plate: StructurePlate): PlateSegment[] => [
  { kind: "label", text: ARRIVING },
  ...plate.arrivals.flatMap((arrival) => [
    { kind: "cue", text: formatDuration(arrival.secondsLeft) } as const,
    { kind: "troops", troops: arrival.troops } as const,
  ]),
];
