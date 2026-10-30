import { formatDuration } from "@bibliothecadao/types";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { ARRIVING, siteTitle, UNDEFENDED } from "@/ui/design-system/kit/words";

import { attackOrder, type ArmyPlate, type MapPlate, type PlateTroops, type StructurePlate } from "./map-plate-model";

/**
 * One reading on a plate, in the HUD panel's voice: a player in the side's colour, a place's own name as a title, a
 * kind in plain words, a label (a reward, a state, what a number counts) in the panel's label colour, a time as its
 * cue, a troop stack as its painting, tier chip and count, an army's stamina as its bar and "x/y".
 */
export type PlateSegment =
  | { kind: "owner"; text: string }
  | { kind: "title"; text: string }
  | { kind: "word"; text: string }
  | { kind: "label"; text: string }
  | { kind: "cue"; text: string }
  | { kind: "troops"; troops: PlateTroops }
  | ({ kind: "stamina" } & StaminaBar)
  /** Between the guard slots, in the order an attacker meets them. */
  | { kind: "next" }
  /** Between two readings on one row: a player and their realm ("clientlane | Stolsli"), a guard and what is beside it. */
  | { kind: "divider" };

type PlateRow = readonly PlateSegment[];

/**
 * What a plate says opened, row by row (the owner's rounds 5 and 6 of the map labels, the sheet's round 3), at most
 * three, from the most important fact down. No id anywhere. At rest a thing is its token (map-plate-token.tsx).
 *
 * - An army: "player | home realm" as on that realm's plate ("clientlane | Stolsli"), then its troops, then its stamina
 *   on its own row, the bar with its exact "84/150" (owner, map labels 2026-10-18).
 * - A realm or a hyperstructure: "player | name", its guard slots in attack order, each with its stamina under it, and
 *   a row of troops on their way, each time before its troops. In a game with no guard slots (Frontier) a realm has no
 *   guard to tell, so no guard row: nobody can attack it (owner, map labels 2026-10-19).
 * - A camp or a rift: its owner, its lore name and kind, and its guard with what it holds beside it.
 */
export const plateRows = (plate: MapPlate): PlateRow[] => {
  if (plate.kind === "army") return armyRows(plate);
  return plate.named ? placeRows(plate) : siteRows(plate);
};

const armyRows = (plate: ArmyPlate): PlateRow[] => [
  whose(plate.owner, plate.homeName),
  [{ kind: "troops", troops: plate.troops }],
  ...(plate.stamina ? [[{ kind: "stamina", ...plate.stamina } as const]] : []),
];

const placeRows = (plate: StructurePlate): PlateRow[] => {
  const rows: PlateRow[] = [whose(plate.owner, plate.name)];
  if (plate.guards) rows.push(guard(plate.guards));
  if (plate.arrivals.length > 0) rows.push(arrivals(plate));
  return rows;
};

const siteRows = (plate: StructurePlate): PlateRow[] => {
  // A beast's site is named by its species, its place and kind above it (the base's beast identity).
  const name: PlateSegment = plate.beast
    ? { kind: "title", text: plate.beast }
    : plate.place
      ? { kind: "title", text: plate.place }
      : { kind: "word", text: plate.name };
  // Three rows at most: what it holds, and troops on their way to one of the player's own sites, follow its guard.
  const holds = plate.reward ? [{ kind: "divider" } as const, { kind: "label", text: plate.reward } as const] : [];
  const arriving = plate.arrivals.length > 0 ? [{ kind: "divider" } as const, ...arrivals(plate)] : [];
  const owner = plate.beast ? siteTitle(plate.place, plate.name, plate.beast) : plate.owner;
  const rows: PlateRow[] = [
    owner ? [{ kind: "owner", text: owner }] : [],
    !plate.beast && plate.place ? [name, { kind: "word", text: plate.name }] : [name],
    [...(plate.guards ? guard(plate.guards) : []), ...holds, ...arriving],
  ];
  return rows.filter((row) => row.length > 0);
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
 * A guard: none, "Undefended"; else every slot in the order an attacker meets them, each with its stamina under it
 * where it is known (owner, map labels 2026-10-19 13:00Z: "we do need to see army stamina on structure hover").
 */
const guard = (guards: readonly PlateTroops[]): PlateSegment[] =>
  guards.length === 0
    ? [{ kind: "label", text: UNDEFENDED }]
    : attackOrder(guards).flatMap((slot, index) => [
        ...(index > 0 ? [{ kind: "next" } as const] : []),
        { kind: "troops", troops: slot } as const,
      ]);

/** Troops on their way, each when it arrives and then what arrives: "Arriving 13m T2 300". */
const arrivals = (plate: StructurePlate): PlateSegment[] => [
  { kind: "label", text: ARRIVING },
  ...plate.arrivals.flatMap((arrival) => [
    { kind: "cue", text: formatDuration(arrival.secondsLeft) } as const,
    { kind: "troops", troops: arrival.troops } as const,
  ]),
];
