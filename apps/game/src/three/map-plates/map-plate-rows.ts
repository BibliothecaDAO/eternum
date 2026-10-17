import { formatDuration } from "@/ui/design-system/kit/time";
import { ARRIVING, UNDEFENDED } from "@/ui/design-system/kit/words";

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
 * kind in plain words, a label (a rank, a reward, a state) in the panel's label gold, an id as its small cue, a count
 * in white, a troop stack as its painting, tier chip and count.
 */
export type PlateSegment =
  | { kind: "owner"; text: string }
  | { kind: "title"; text: string }
  | { kind: "word"; text: string }
  | { kind: "label"; text: string }
  | { kind: "cue"; text: string }
  | { kind: "count"; text: string }
  | { kind: "troops"; troops: PlateTroops }
  /** Between the guard slots, in the order an attacker meets them. */
  | { kind: "next" }
  /** Between a name and what it holds: "Xeswet | 1,455". */
  | { kind: "divider" };

type PlateRow = readonly PlateSegment[];

/**
 * What a plate says, row by row (the owner's round 5): at rest two short rows, opened (its tile hovered, or selected) at
 * most three, from the most important fact down.
 *
 * - An army: its player, then its troops (stamina at the plate's foot). Opened: the realm it comes from and its id join
 *   the player's row.
 * - A realm or a hyperstructure: its player (and a realm's rank), then its name and guard total. Opened: the guard slots
 *   in attack order replace the total, and a row of troops on their way follows.
 * - A camp or a rift: its kind and what taking it gives, then its guard. Opened: its owner and id lead.
 */
export const plateRows = (plate: MapPlate, open: boolean): PlateRow[] =>
  plate.kind === "army" ? armyRows(plate, open) : plate.named ? placeRows(plate, open) : siteRows(plate, open);

const armyRows = (plate: ArmyPlate, open: boolean): PlateRow[] => [
  open
    ? [
        { kind: "owner", text: plate.owner },
        { kind: "title", text: plate.homeName },
        { kind: "cue", text: plate.code },
      ]
    : [{ kind: "owner", text: plate.owner }],
  [{ kind: "troops", troops: plate.troops }],
];

const placeRows = (plate: StructurePlate, open: boolean): PlateRow[] => {
  const rows: PlateRow[] = [
    [{ kind: "owner", text: plate.owner }, ...(plate.rank ? [{ kind: "label", text: plate.rank } as const] : [])],
    [{ kind: "title", text: plate.name }, { kind: "divider" }, ...guard(plate.guards, open)],
  ];
  if (open && plate.arrivals.length > 0) rows.push(arrivals(plate));
  return rows;
};

const siteRows = (plate: StructurePlate, open: boolean): PlateRow[] => {
  const kind: PlateRow = [
    { kind: "word", text: plate.name },
    ...(plate.reward ? [{ kind: "divider" } as const, { kind: "label", text: plate.reward } as const] : []),
  ];
  if (!open) return [kind, guard(plate.guards, false)];
  // Three rows at most: troops on their way to one of the player's own sites follow its guard on that row.
  const guardRow =
    plate.arrivals.length > 0
      ? [...guard(plate.guards, true), { kind: "divider" } as const, ...arrivals(plate)]
      : guard(plate.guards, true);
  return [
    [
      { kind: "owner", text: plate.owner },
      { kind: "cue", text: plate.code },
    ],
    kind,
    guardRow,
  ];
};

/**
 * A guard: none, "Undefended"; at rest one number (a single slot as its troop stack, several as their total); opened,
 * every slot in the order an attacker meets them.
 */
const guard = (guards: readonly PlateTroops[], open: boolean): PlateSegment[] => {
  const resting = restingGuard(guards);
  if (resting.kind === "open") return [{ kind: "label", text: UNDEFENDED }];
  if (resting.kind === "slot") return [{ kind: "troops", troops: resting.slot }];
  if (!open) return [{ kind: "count", text: formatCount(resting.total) }];
  return attackOrder(guards).flatMap((slot, index) => [
    ...(index > 0 ? [{ kind: "next" } as const] : []),
    { kind: "troops", troops: slot } as const,
  ]);
};

const arrivals = (plate: StructurePlate): PlateSegment[] => [
  { kind: "label", text: ARRIVING },
  ...plate.arrivals.flatMap((arrival) => [
    { kind: "troops", troops: arrival.troops } as const,
    { kind: "cue", text: formatDuration(arrival.secondsLeft) } as const,
  ]),
];
