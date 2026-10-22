import { siteName } from "@bibliothecadao/types";
import { Token } from "@/three/map-plates/map-plate-token";
import { Plate } from "@/three/map-plates/map-plates";
import type { ArmyPlate, StructurePlate } from "@/three/map-plates/map-plate-model";
import { Icon, SvgIcon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { HudBubble, HudMenu, HudMinimapFrame, HudTierChip } from "@/ui/design-system/kit/hud-elements";
import { LabTip } from "./lab-tip";
import { orderTip } from "@/ui/features/frontier/hud/order-tip";
import { ActionType } from "@bibliothecadao/eternum";
import { type ReactNode } from "react";

import { Element } from "./sheet-element";

/**
 * The owner's round 4: "we also need a style sheet for all contextual elements on the map, fold it into the hud". Every
 * element the game draws on the map itself, at the moment it appears, on a stand-in for the map: the same tokens and
 * elements as the rest of the sheet. world's map overlay study (hex highlights, paths, ownership colours) joins here.
 */

const REALM: StructurePlate = {
  kind: "structure",
  relation: "own",
  owner: "djizus",
  name: "Sangsang",
  named: true,
  guards: [
    { type: "knight", tier: 1, count: 800 },
    { type: "paladin", tier: 3, count: 120 },
  ],
  arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }],
  icon: "realm",
};
const ENEMY_ARMY: ArmyPlate = {
  kind: "army",
  relation: "enemy",
  owner: "Moonhand",
  homeName: "Xeswet",
  troops: { type: "paladin", tier: 3, count: 300 },
  stamina: { current: 84, max: 150 },
};
const CAMP: StructurePlate = {
  kind: "structure",
  relation: "neutral",
  owner: "The Vanguard",
  name: "Camp",
  named: false,
  place: siteName(7 * 2 ** 32 + 41),
  reward: "640 Labor",
  guards: [{ type: "crossbowman", tier: 1, count: 250 }],
  arrivals: [],
  icon: "camp",
};

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
/** The order line as the game writes it (orderTip), for an order or a refusal. */
const line = (order: Partial<Parameters<typeof orderTip>[0]>) => {
  const tip = orderTip({
    path: undefined,
    exploreStamina: 30,
    food: { wheat: 0, fish: 0 },
    explored: true,
    refusal: undefined,
    staminaWait: undefined,
    site: undefined,
    ...order,
  });
  return tip ? <LabTip line={tip.line} cost={tip.cost ?? undefined} /> : null;
};

/** A thing as the plate layer draws it, standing in the page: its token, or its plate opened. */
const PlateAt = ({
  plate,
  open = false,
  selected = false,
}: {
  plate: StructurePlate | ArmyPlate;
  open?: boolean;
  selected?: boolean;
}) => (
  <div className="mp !static !overflow-visible">
    <div className="mp-at !static" data-relation={plate.relation} data-selected={selected}>
      {open ? <Plate plate={plate} /> : <Token plate={plate} />}
    </div>
  </div>
);

/** A stand-in for the map under one element: the lore's mist, darkened as the world map is under the HUD. */
const OnMap = ({ name, when, children }: { name: string; when: string; children: ReactNode }) => (
  <figure data-map-context={name} className="flex flex-col gap-2">
    <div className="relative isolate flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-white/10 p-4">
      <img
        src="/images/landscapes/frontier-mist-800.webp"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover opacity-30 brightness-50"
      />
      <div className="flex flex-col items-center gap-2">{children}</div>
    </div>
    <figcaption data-lab-chrome className="text-sm text-white">
      <b>{name}</b> <span className="text-white/60">{when}</span>
    </figcaption>
  </figure>
);

/** Troops on their way to a tile, drawn on the tile they reach: their troops and when. */
const ArrivalMarker = () => (
  <span className="ui ui-pill" role="img" aria-label="Arriving: 300 Paladins T2 in 13 minutes">
    <Icon name="paladin-t2" size={18} />
    <HudTierChip tier={2} />
    <span className="text-hud-strong">300</span>
    <span className="text-hud-label text-hud-cue">13m</span>
  </span>
);

/** The minimap's lattice: pointy hexes, offset rows. */
const HEX = 8;
const COLS = 23;
const ROWS = 13;
const at = (col: number, row: number) => ({
  x: 10 + HEX * Math.sqrt(3) * (col + 0.5 * (row & 1)),
  y: 10 + HEX * 1.5 * row,
});
const hexPoints = (x: number, y: number, radius: number) =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(" ");

type Side = "own" | "ally" | "enemy" | "neutral";
const SIDE = (side: Side) => `var(--hud-${side})`;
/** What the player has walked: around the realm and along the army's road; the rest is fog. */
const explored = (col: number, row: number) =>
  Math.hypot(col - 8, (row - 6) * 1.2) < 6.5 || Math.hypot(col - 15, (row - 7) * 1.2) < 4.5;
const MARKERS: readonly { col: number; row: number; name: IconMeaning; side: Side }[] = [
  { col: 8, row: 6, name: "map-realm-1", side: "own" },
  { col: 15, row: 7, name: "map-realm-2", side: "enemy" },
  { col: 11, row: 3, name: "camp", side: "neutral" },
  { col: 5, row: 9, name: "rift", side: "neutral" },
  { col: 13, row: 10, name: "hyperstructure", side: "ally" },
];
const DOTS: readonly { col: number; row: number; side: Side }[] = [
  { col: 10, row: 7, side: "own" },
  { col: 6, row: 4, side: "own" },
  { col: 14, row: 5, side: "enemy" },
  { col: 12, row: 9, side: "ally" },
  { col: 9, row: 2, side: "neutral" },
];

/** A marker on the minimap: its painting in a hex ringed in its side's colour. */
const MinimapMarker = ({ col, row, name, side }: (typeof MARKERS)[number]) => {
  const { x, y } = at(col, row);
  return (
    <g data-marker={name} data-side={side}>
      <polygon
        points={hexPoints(x, y, HEX * 1.25)}
        fill="var(--hud-surface-to)"
        stroke={SIDE(side)}
        strokeWidth={1.4}
      />
      <SvgIcon name={name} x={x - HEX} y={y - HEX} size={HEX * 2} />
    </g>
  );
};

/** Something past the minimap's edge (a chosen army off view, an enemy closing in), as an arrow on the frame. */
const EdgeMarker = ({ x, y, angle, side }: { x: number; y: number; angle: number; side: Side | "accent" }) => (
  <path
    d="M 0 -6 L 6 4 L -6 4 Z"
    transform={`translate(${x} ${y}) rotate(${angle})`}
    fill={side === "accent" ? "rgb(var(--hud-accent))" : SIDE(side)}
    stroke="var(--hud-surface-to)"
    strokeWidth={1}
  />
);

/**
 * The minimap as the sheet draws it: its frame, the walked land and the fog, whose things stand where (a dot for a
 * thing, a marker for a place), arrows on the edge for what is off view. It is centred on the camera and zooms with it,
 * with no mark of the camera's view; a drag pans the minimap and the camera follows.
 */
const Minimap = () => {
  const legend: readonly [string, string][] = [
    ["Frame", "the panel with no header, its map in a well (HudMinimapFrame)"],
    ["Walked land and fog", "what the player has revealed in the surface's light, the rest in the well's dark"],
    ["Dots", "a thing where it stands, in its side's colour: yours, an ally's, an enemy's, nobody's"],
    ["Markers", "a place (realm, camp, rift, hyperstructure) as its painting in a hex ringed in its side's colour"],
    ["Camera", "the minimap is centred on the camera and zooms with it; no mark of its view is drawn"],
    ["Edge arrows", "what is past the edge: the chosen army in the accent, an enemy closing in in red"],
    ["Drag", "a drag pans the minimap and the camera follows"],
  ];
  return (
    <figure data-map-context="Minimap" className="grid grid-cols-[22rem_minmax(0,1fr)] items-start gap-6">
      <HudMinimapFrame>
        <svg viewBox="0 0 330 185" className="block w-full" role="img" aria-label="Minimap">
          {Array.from({ length: COLS * ROWS }, (_, index) => {
            const col = index % COLS;
            const row = Math.floor(index / COLS);
            const { x, y } = at(col, row);
            return (
              <polygon
                key={index}
                points={hexPoints(x, y, HEX)}
                fill={explored(col, row) ? "rgb(var(--hud-ink) / 0.1)" : "var(--hud-well)"}
                stroke="var(--hud-divider)"
                strokeWidth={0.5}
              />
            );
          })}
          {DOTS.map(({ col, row, side }) => {
            const { x, y } = at(col, row);
            return <circle key={`${col}-${row}`} cx={x} cy={y} r={3} fill={SIDE(side)} />;
          })}
          {MARKERS.map((marker) => (
            <MinimapMarker key={marker.name} {...marker} />
          ))}
          <EdgeMarker x={322} y={60} angle={90} side="enemy" />
          <EdgeMarker x={170} y={8} angle={0} side="accent" />
        </svg>
      </HudMinimapFrame>
      <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {legend.map(([term, meaning]) => (
          <div key={term} className="contents">
            <dt className="font-bold text-white">{term}</dt>
            <dd className="text-white/70">{meaning}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
};

export const MapContextSection = ({ world }: { world?: ReactNode }) => (
  <Element
    name="Map context"
    wide
    rule="Everything drawn on the map itself, and the minimap, at the moment it appears: the same tokens and elements as the rest of the HUD. A right-click acts; nothing here asks for an extra click. world's 3D overlay comparison (hexes, paths, ownership) mounts below."
    sheet={
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <OnMap
            name="Action bubbles"
            when="Around the selected realm or army: its orders as bubbles, a count to act on as a badge."
          >
            <PlateAt plate={REALM} selected />
            <div className="flex gap-3">
              <HudBubble icon="military" word="Military" count={2} />
              <HudBubble icon="transfer" word="Transfer" />
              <HudBubble icon="build" word="Build" />
            </div>
          </OnMap>
          <OnMap
            name="Plates"
            when="Over every realm, army, camp and rift: its token at rest, its plate in the token's place on hover."
          >
            <div className="flex items-end gap-3">
              <PlateAt plate={CAMP} />
              <PlateAt plate={CAMP} open />
            </div>
            <div className="flex items-end gap-3">
              <PlateAt plate={ENEMY_ARMY} />
              <PlateAt plate={ENEMY_ARMY} open />
            </div>
          </OnMap>
          <OnMap
            name="Order line"
            when="Under the hovered tile while an army is selected: the right-click's order, and under it what it costs."
          >
            {line({ path: [step(ActionType.Move), step(ActionType.Explore)], food: { wheat: 100, fish: 0 } })}
            {line({ path: [step(ActionType.Move), step(ActionType.Attack, 50)] })}
            {line({ path: [step(ActionType.Move), step(ActionType.Help)] })}
          </OnMap>
          <OnMap name="Refusals" when="The same line where no order leads: why, and when it will, to the second.">
            {line({ refusal: { reason: "stamina", need: 30 }, staminaWait: 24 })}
            {line({ refusal: { reason: "too-far" } })}
            {line({ explored: false })}
          </OnMap>
          <OnMap name="Crate and spire" when="Beside a relic crate or a spire: the right-click opens or travels.">
            {line({ path: [step(ActionType.Move), step(ActionType.Chest)] })}
            {line({ path: [step(ActionType.Move), step(ActionType.SpireTravel)] })}
          </OnMap>
          <OnMap name="Structure menu" when="A right-click on your own realm: what it can raise, one click each.">
            <HudMenu
              items={[
                { label: "Create Attack Army", icon: "military" },
                { label: "Create Defense Army", icon: "defend" },
              ]}
            />
          </OnMap>
          <OnMap
            name="Deploy picker"
            when="A right-click on a tile beside your realm: the Deploy army layout picked above, hung on the tile."
          >
            <LabTip line="Deploy an army here" />
          </OnMap>
          <OnMap
            name="Arrivals"
            when="On the tile troops are marching to: what arrives and when; the realm's plate says it on hover too."
          >
            <ArrivalMarker />
            <PlateAt plate={REALM} open />
          </OnMap>
        </div>
        <Minimap />
        {world}
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: bubbles (world/hud/action-bubbles.tsx, HudBubble), plates (three/map-plates), the order line
        (three/scenes/worldmap-order-tip.tsx), the structure menu (three/scenes/context-menu, its own look), the deploy
        picker (military/components/army-deployment-picker.tsx), arrivals only inside panels (incoming-caravans.tsx).
        The minimap (world/components/bottom-right-panel/hex-minimap.tsx) draws biome colours, cyan and orange dots,
        HexMarker's own side colours (yours green, an ally blue). Each is styled on its own; here they share the sheet.
      </span>
    }
  />
);
