import type { ReactNode } from "react";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";

import { declutter, placeCard, stack, type LabelBox } from "./map-label-layout";
import { labelName, type NamingScheme } from "./map-label-naming";

/**
 * Three ways to label the map, for the owner to pick from. Each answers the same three questions: what stays on the map
 * at rest (and at which zoom), what a hover adds and where it goes so it never covers another label, and how the
 * selected thing stands out.
 */
export const LABEL_SYSTEMS = {
  banner: {
    name: "A · Banners",
    rest: "Plates for realms, the hyperstructure and armies at play zoom; camps and rifts are pins until you zoom in. Where two plates meet, the more important keeps its plate and the other drops to a pin.",
    hover:
      "A card beside the thing, on the side that covers the fewest plates; any plate still under it steps aside while it shows.",
    selected: "A gold ring, and its plate never drops to a pin.",
  },
  pins: {
    name: "B · Pins and a docked card",
    rest: "Pins only: the kind's painting ringed in the side's colour, an army's tier on it. Names under your own realms (every realm when zoomed in).",
    hover: "The card docks at the map's bottom left, tied to the pin by a thin line: it never covers the map.",
    selected: "A gold ring and its name; the docked card shows it while nothing is hovered.",
  },
  expand: {
    name: "C · Plates that open",
    rest: "Every thing has a compact plate (zoomed in, with its strength). Plates that meet stack upward, two steps at most, then drop to a pin.",
    hover: "The plate itself opens upward into the card; plates it would cover step aside.",
    selected: "Stays open, ringed in gold, until something else is hovered.",
  },
} as const;

export type LabelSystem = keyof typeof LABEL_SYSTEMS;
export type MapZoom = "play" | "close";

/** An entity where it stands on screen this frame. */
export interface ProjectedEntity {
  key: string;
  entity: MapLabelEntity;
  x: number;
  y: number;
}

interface LabelsProps {
  system: LabelSystem;
  items: readonly ProjectedEntity[];
  zoom: MapZoom;
  naming: NamingScheme;
  hovered: string | null;
  selected: string | null;
  view: { width: number; height: number };
}

export const MapLabels = (props: LabelsProps) => {
  switch (props.system) {
    case "banner":
      return <Banners {...props} />;
    case "pins":
      return <Pins {...props} />;
    case "expand":
      return <OpeningPlates {...props} />;
  }
};

const PLATE_HEIGHT = 26;
const PIN = 30;

const Banners = ({ items, zoom, naming, hovered, selected, view }: LabelsProps) => {
  const wantsPlate = (item: ProjectedEntity) =>
    zoom === "close" || item.key === selected || item.key === hovered || !isSite(item.entity);
  const plates = items.filter(wantsPlate).map((item) => plateBox(item, naming, hovered, selected));
  const kept = declutter(plates);
  const marks = [...plates.filter((box) => kept.has(box.id)), ...items.filter((i) => !kept.has(i.key)).map(pinBox)];
  const hoveredItem = items.find((item) => item.key === hovered);
  const card = hoveredItem
    ? placeCard(
        hoveredItem,
        cardSize(hoveredItem.entity),
        marks.filter((box) => box.id !== hoveredItem.key),
        view,
      )
    : null;
  const yields = new Set(card?.covers);
  return (
    <>
      {items.map((item) => (
        <Placed key={item.key} item={item} hovered={hovered} selected={selected} yields={yields.has(item.key)}>
          {item.key === hovered ? null : kept.has(item.key) ? (
            <Plate entity={item.entity} naming={naming} />
          ) : (
            <Pin entity={item.entity} />
          )}
        </Placed>
      ))}
      {hoveredItem && card && (
        <div
          className="mll-at"
          style={{ transform: `translate(${card.x}px, ${card.y}px)` }}
          data-relation={hoveredItem.entity.relation}
        >
          <Card entity={hoveredItem.entity} naming={naming} />
        </div>
      )}
    </>
  );
};

const Pins = ({ items, zoom, naming, hovered, selected, view }: LabelsProps) => {
  const wantsName = (item: ProjectedEntity) =>
    item.key === selected ||
    item.key === hovered ||
    (item.entity.kind === "realm" && (zoom === "close" || item.entity.relation === "own")) ||
    (zoom === "close" && item.entity.kind === "hyperstructure");
  const tags = items.filter(wantsName).map((item) => ({
    ...plateBox(item, naming, hovered, selected),
    y: item.y + PIN / 2,
  }));
  const named = declutter(tags);
  const docked = items.find((item) => item.key === hovered) ?? items.find((item) => item.key === selected);
  return (
    <>
      {items.map((item) => (
        <Placed key={item.key} item={item} hovered={hovered} selected={selected} yields={false} centered>
          <div className="flex flex-col items-center">
            <Pin entity={item.entity} />
            {named.has(item.key) && <span className="mll-tag">{labelName(item.entity, naming)}</span>}
          </div>
        </Placed>
      ))}
      {docked && (
        <>
          <Leader from={docked} to={{ x: 16 + 118, y: view.height - 16 - cardSize(docked.entity).height }} />
          <div className="mll-dock" data-relation={docked.entity.relation} data-selected={docked.key === selected}>
            <Card entity={docked.entity} naming={naming} />
          </div>
        </>
      )}
    </>
  );
};

const OpeningPlates = ({ items, zoom, naming, hovered, selected, view }: LabelsProps) => {
  const plates = items.map((item) => plateBox(item, naming, hovered, selected, zoom === "close"));
  const lifts = stack(plates);
  const open = items.find((item) => item.key === hovered) ?? items.find((item) => item.key === selected);
  const openLift = open ? (lifts.get(open.key) ?? 0) : 0;
  const card = open ? cardSize(open.entity) : null;
  const cardBox =
    open && card
      ? {
          x: Math.min(Math.max(open.x - card.width / 2, 8), view.width - card.width - 8),
          y: Math.max(open.y - openLift - PLATE_HEIGHT - card.height + PLATE_HEIGHT, 8),
          ...card,
        }
      : null;
  const yields = new Set(
    cardBox
      ? plates
          .filter((box) => box.id !== open?.key && lifts.has(box.id))
          .filter((box) => intersects({ ...box, y: box.y - (lifts.get(box.id) ?? 0) }, cardBox))
          .map((box) => box.id)
      : [],
  );
  return (
    <>
      {items.map((item) => {
        const lift = lifts.get(item.key);
        return (
          <Placed
            key={item.key}
            item={{ ...item, y: item.y - (lift ?? 0) }}
            hovered={hovered}
            selected={selected}
            yields={yields.has(item.key)}
          >
            {item.key === open?.key ? null : lift !== undefined ? (
              <Plate entity={item.entity} naming={naming} strength={zoom === "close"} />
            ) : (
              <Pin entity={item.entity} />
            )}
          </Placed>
        );
      })}
      {open && cardBox && (
        <div
          className="mll-at"
          style={{ transform: `translate(${cardBox.x}px, ${cardBox.y}px)` }}
          data-relation={open.entity.relation}
          data-selected={open.key === selected}
        >
          <Card entity={open.entity} naming={naming} />
        </div>
      )}
    </>
  );
};

/** A mark at its entity's place: a plate's bottom centre (or a pin's centre) on the anchor. */
const Placed = ({
  item,
  hovered,
  selected,
  yields,
  centered = false,
  children,
}: {
  item: ProjectedEntity;
  hovered: string | null;
  selected: string | null;
  yields: boolean;
  centered?: boolean;
  children: ReactNode;
}) => (
  <div
    className="mll-at"
    data-relation={item.entity.relation}
    data-hovered={item.key === hovered}
    data-selected={item.key === selected}
    data-yields={yields}
    style={{ transform: `translate(${item.x}px, ${item.y}px) translate(-50%, ${centered ? "-50%" : "-100%"})` }}
  >
    {children}
  </div>
);

const Plate = ({
  entity,
  naming,
  strength = false,
}: {
  entity: MapLabelEntity;
  naming: NamingScheme;
  strength?: boolean;
}) => (
  <div className="mll-plate relative">
    <Icon name={kindIcon(entity)} size={18} />
    <span>{labelName(entity, naming)}</span>
    {entity.kind === "army" && entity.relation !== "own" && <span className="mll-tier">T{entity.troops.tier}</span>}
    {strength && entity.kind !== "army" && <span className="mll-tier">{formatCount(entity.troops.count)}</span>}
    {entity.army && entity.relation === "own" && (
      <span className="mll-plate__meter">
        <i style={{ width: `${(100 * entity.army.stamina) / entity.army.staminaMax}%` }} />
      </span>
    )}
  </div>
);

const Pin = ({ entity }: { entity: MapLabelEntity }) => (
  <div className="mll-pin">
    <Icon name={kindIcon(entity)} size={20} />
    {entity.kind === "army" && <span className="mll-pin__badge">T{entity.troops.tier}</span>}
  </div>
);

const REALM_LEVELS = ["Settlement", "City", "Kingdom", "Empire"] as const;

/** The hover card: what it is and whose, its strength, and an army's stamina or a realm's level. Four lines at most. */
const Card = ({ entity, naming }: { entity: MapLabelEntity; naming: NamingScheme }) => (
  <div className="mll-card">
    <div className="mll-card__head">
      <Icon name={kindIcon(entity)} size={28} />
      <div className="min-w-0">
        <div className="mll-card__title truncate">{labelName(entity, naming)}</div>
        <div className="mll-card__owner">{ownerLine(entity)}</div>
      </div>
    </div>
    <div className="mll-card__row">
      <Icon name={entity.kind === "army" ? troopIcon(entity) : "defend"} size={20} />
      <span>{entity.kind === "army" ? "Troops" : "Guard"}</span>
      <span className="ml-auto tabular-nums">{formatCount(entity.troops.count)}</span>
      <span className="mll-tier">T{entity.troops.tier}</span>
    </div>
    {entity.army && (
      <div className="mll-card__row">
        <Icon name="stamina" size={20} />
        <span className="mll-card__track">
          <i style={{ width: `${(100 * entity.army.stamina) / entity.army.staminaMax}%` }} />
        </span>
        <span className="tabular-nums">
          {entity.army.stamina}/{entity.army.staminaMax}
        </span>
      </div>
    )}
    {entity.kind === "realm" && <div className="mll-card__row">{REALM_LEVELS[entity.level]}</div>}
  </div>
);

/** The thin line from a hovered pin to the docked card that describes it. */
const Leader = ({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <span
      className="mll-leader"
      style={{
        width: Math.hypot(dx, dy),
        transform: `translate(${from.x}px, ${from.y}px) rotate(${Math.atan2(dy, dx)}rad)`,
      }}
    />
  );
};

const ownerLine = (entity: MapLabelEntity) => {
  if (entity.owner === null) return entity.kind === "hyperstructure" ? "Unclaimed" : "Bandits";
  return entity.relation === "own" ? `Yours · ${entity.owner}` : entity.owner;
};

const isSite = (entity: MapLabelEntity) => entity.kind === "camp" || entity.kind === "rift";

const kindIcon = (entity: MapLabelEntity): IconMeaning => {
  switch (entity.kind) {
    case "realm":
      return `realm-${entity.level}` as IconMeaning;
    case "army":
      return "map-army";
    default:
      return entity.kind;
  }
};

const troopIcon = (entity: MapLabelEntity) => `knight-t${entity.troops.tier}` as IconMeaning;

const formatCount = (count: number) => count.toLocaleString("en-US");

/** How much a thing's place in the label order is worth: selected, hovered, yours, then what threatens you. */
const PRIORITY: Record<MapLabelEntity["relation"], number> = { own: 60, enemy: 40, ally: 30, neutral: 10 };
const KIND_WEIGHT: Record<MapLabelEntity["kind"], number> = { army: 8, realm: 6, hyperstructure: 5, camp: 2, rift: 1 };

const priorityOf = (key: string, entity: MapLabelEntity, hovered: string | null, selected: string | null) =>
  (key === selected ? 1000 : 0) + (key === hovered ? 500 : 0) + PRIORITY[entity.relation] + KIND_WEIGHT[entity.kind];

const measure = (() => {
  let context: CanvasRenderingContext2D | null = null;
  return (text: string) => {
    context ??= document.createElement("canvas").getContext("2d");
    if (!context) return text.length * 8;
    context.font = '600 14px "Exo 2"';
    return context.measureText(text).width;
  };
})();

const plateBox = (
  item: ProjectedEntity,
  naming: NamingScheme,
  hovered: string | null,
  selected: string | null,
  strength = false,
): LabelBox => {
  const extra = item.entity.kind === "army" && item.entity.relation !== "own" ? 30 : strength ? 48 : 0;
  const width = Math.ceil(measure(labelName(item.entity, naming)) + 18 + 5 + 13 + 4 + extra);
  return {
    id: item.key,
    x: item.x - width / 2,
    y: item.y - PLATE_HEIGHT,
    width,
    height: PLATE_HEIGHT,
    priority: priorityOf(item.key, item.entity, hovered, selected),
  };
};

const pinBox = (item: ProjectedEntity): LabelBox => ({
  id: item.key,
  x: item.x - PIN / 2,
  y: item.y - PIN,
  width: PIN,
  height: PIN,
  priority: 0,
});

const cardSize = (entity: MapLabelEntity) => ({
  width: 236,
  height: 62 + 27 * (entity.army || entity.kind === "realm" ? 2 : 1),
});

const intersects = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
