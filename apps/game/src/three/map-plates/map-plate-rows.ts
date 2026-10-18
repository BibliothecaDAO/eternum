import { formatDuration } from "@/ui/design-system/kit/time";
import { ARRIVING, GUARD, STRENGTH, UNDEFENDED } from "@/ui/design-system/kit/words";

import {
  attackOrder,
  formatCount,
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
  /** Between a name and what it holds: "Xeswet | 1,455". */
  | { kind: "divider" };

type PlateRow = readonly PlateSegment[];

/**
 * What a plate says, row by row (the owner's rounds 5 and 6 of the map labels, the sheet's round 3): at rest two short
 * rows, opened (its tile hovered, or selected) at most three, from the most important fact down. No id anywhere.
 *
 * - An army: its player, then its troops and its stamina ("84/150"). Opened: the realm it comes from joins the player.
 * - A realm or a hyperstructure: its player and its name, then its guard total and strength. Opened: the guard slots in
 *   attack order replace the total, and a row of troops on their way follows, each time before its troops.
 * - A camp or a rift: its lore name and kind, then its guard and what taking it gives. Opened: its owner leads.
 */
export const plateRows = (plate: MapPlate, open: boolean): PlateRow[] =>
  plate.kind === "army" ? armyRows(plate, open) : plate.named ? placeRows(plate, open) : siteRows(plate, open);

const armyRows = (plate: ArmyPlate, open: boolean): PlateRow[] => [
  open
    ? [
        { kind: "owner", text: plate.owner },
        { kind: "title", text: plate.homeName },
      ]
    : [{ kind: "owner", text: plate.owner }],
  [
    { kind: "troops", troops: plate.troops },
    ...(plate.stamina ? [{ kind: "stamina", ...plate.stamina } as const] : []),
  ],
];

const placeRows = (plate: StructurePlate, open: boolean): PlateRow[] => {
  const rows: PlateRow[] = [
    [{ kind: "owner", text: plate.owner }, { kind: "divider" }, { kind: "title", text: plate.name }],
    restingGuard(plate.guards).kind === "open"
      ? [{ kind: "label", text: UNDEFENDED }]
      : [...(open ? slots(plate.guards) : guardTotal(plate.guards)), { kind: "divider" }, ...strength(plate)],
  ];
  if (open && plate.arrivals.length > 0) rows.push(arrivals(plate));
  return rows;
};

const siteRows = (plate: StructurePlate, open: boolean): PlateRow[] => {
  const name: PlateRow = [
    ...(plate.place ? [{ kind: "title", text: plate.place } as const] : []),
    { kind: "word", text: plate.name },
  ];
  const reward = plate.reward ? [{ kind: "divider" } as const, { kind: "label", text: plate.reward } as const] : [];
  if (!open) return [name, [...guard(plate.guards, false), ...reward]];
  // Three rows at most: troops on their way to one of the player's own sites follow its guard on that row.
  const arriving = plate.arrivals.length > 0 ? [{ kind: "divider" } as const, ...arrivals(plate)] : [];
  return [[{ kind: "owner", text: plate.owner }], name, [...guard(plate.guards, true), ...reward, ...arriving]];
};

/**
 * A site's guard: none, "Undefended"; at rest one number (a single slot as its troop stack, several as their total);
 * opened, every slot in the order an attacker meets them.
 */
const guard = (guards: readonly PlateTroops[], open: boolean): PlateSegment[] => {
  const resting = restingGuard(guards);
  if (resting.kind === "open") return [{ kind: "label", text: UNDEFENDED }];
  if (resting.kind === "slot") return [{ kind: "troops", troops: resting.slot }];
  return open ? slots(guards) : [{ kind: "count", text: formatCount(resting.total) }];
};

const slots = (guards: readonly PlateTroops[]): PlateSegment[] =>
  attackOrder(guards).flatMap((slot, index) => [
    ...(index > 0 ? [{ kind: "next" } as const] : []),
    { kind: "troops", troops: slot } as const,
  ]);

/** A realm's guard at rest: how many troops guard it ("1,731 guard"). */
const guardTotal = (guards: readonly PlateTroops[]): PlateSegment[] => [
  { kind: "count", text: formatCount(guards.reduce((sum, slot) => sum + slot.count, 0)) },
  { kind: "label", text: GUARD },
];

const strength = (plate: StructurePlate): PlateSegment[] => [
  { kind: "count", text: formatCount(plate.strength) },
  { kind: "label", text: STRENGTH },
];

/** Troops on their way, each when it arrives and then what arrives: "Arriving 13m T2 300". */
const arrivals = (plate: StructurePlate): PlateSegment[] => [
  { kind: "label", text: ARRIVING },
  ...plate.arrivals.flatMap((arrival) => [
    { kind: "cue", text: formatDuration(arrival.secondsLeft) } as const,
    { kind: "troops", troops: arrival.troops } as const,
  ]),
];
