import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import type { MapLabelEntity, MapLabelTroops } from "@/three/debug/map-label-lab-fixture";

import { stack, type LabelBox } from "./map-label-layout";
import { codeName, formatCount, restingGuard, TROOP_WORD } from "./map-label-reading";

/**
 * The owner's pick (rounds 2 and 3): plates that open. At rest a plate holds one row: an army's troops, stamina and
 * home realm; a structure's owner and one guard number; a camp's or rift's reward and guard. Hovering the tile a thing
 * stands on opens its plate upward, adding only what the row does not say. Plates that meet stack upward, two steps at
 * most, then drop to a pin.
 */
export const PLATE_RULES = {
  rest: "Army: its troops (type, tier, count), stamina bar, and the realm it comes from. Realm and hyperstructure: owner and one guard number: a single slot as its troop type, tier and count; several as their total; none, Open. Camp and rift: its reward and its guard.",
  hover:
    "Hover the tile: the plate opens with its name (a realm's level), whose it is where the row does not say, and each guard slot's troop type, tier and count when there are several.",
  selected: "Stays open, ringed in gold.",
} as const;

export type MapZoom = "play" | "close";

/** An entity where it stands on screen this frame. */
export interface ProjectedEntity {
  key: string;
  entity: MapLabelEntity;
  x: number;
  y: number;
}

export const MapPlates = ({
  items,
  hovered,
  selected,
}: {
  items: readonly ProjectedEntity[];
  hovered: string | null;
  selected: string | null;
}) => {
  const boxes = items.map((item) => plateBox(item, hovered, selected));
  const lifts = stack(boxes);
  const open = items.find((item) => item.key === hovered) ?? items.find((item) => item.key === selected);
  const openBox = open ? boxes.find((box) => box.id === open.key) : undefined;
  // The opened plate grows upward by its extra lines; the plates it would then cover step aside.
  const grown = openBox &&
    open && {
      ...openBox,
      y: openBox.y - (lifts.get(openBox.id) ?? 0) - OPEN_LINE * openLines(open.entity),
      height: openBox.height + OPEN_LINE * openLines(open.entity),
    };
  const yields = new Set(
    grown
      ? boxes
          .filter((box) => box.id !== open?.key && lifts.has(box.id))
          .filter((box) => intersects({ ...box, y: box.y - (lifts.get(box.id) ?? 0) }, grown))
          .map((box) => box.id)
      : [],
  );
  return (
    <>
      {items.map((item) => {
        const lift = item.key === open?.key ? (lifts.get(item.key) ?? 0) : lifts.get(item.key);
        return (
          <div
            key={item.key}
            className="mll-at"
            data-relation={item.entity.relation}
            data-selected={item.key === selected}
            data-yields={yields.has(item.key)}
            style={{
              transform: `translate(${item.x}px, ${item.y - (lift ?? 0)}px) translate(-50%, ${lift === undefined ? "-50%" : "-100%"})`,
              // A pin sits under the plates around it; an opened plate over everything.
              zIndex: item.key === open?.key ? 5 : lift === undefined ? 0 : 1,
            }}
          >
            {lift === undefined ? (
              <Pin entity={item.entity} />
            ) : (
              <Plate entity={item.entity} open={item.key === open?.key} />
            )}
          </div>
        );
      })}
    </>
  );
};

const PLATE_HEIGHT = 30;
const OPEN_LINE = 24;

/** The plate: its row of facts; opened, the lines the row does not hold stand above it. */
const Plate = ({ entity, open }: { entity: MapLabelEntity; open: boolean }) => (
  <div className="mll-plate" data-open={open}>
    {open && <OpenLines entity={entity} />}
    <div className="mll-plate__row">{entity.army ? <ArmyRow entity={entity} /> : <StructureRow entity={entity} />}</div>
    {entity.army && (
      <span className="mll-plate__meter" title="Stamina">
        <i style={{ width: `${(100 * entity.army.stamina) / entity.army.staminaMax}%` }} />
      </span>
    )}
  </div>
);

/** An army: its troops, then the realm it comes from. */
const ArmyRow = ({ entity }: { entity: MapLabelEntity }) => (
  <>
    <Troops troops={entity.army!.troops} />
    <span className="mll-from">
      <Icon name="realm" size={16} />
      {entity.homeName}
    </span>
  </>
);

/** A structure: its reward (a camp or a rift) or its owner, then one guard number. */
const StructureRow = ({ entity }: { entity: MapLabelEntity }) => (
  <>
    <Icon name={kindIcon(entity)} size={20} />
    {entity.reward ? (
      <span className="mll-reward">
        <Icon name={resourceMeaning(entity.reward.resource)} size={18} />
        <span className="tabular-nums">{formatCount(entity.reward.amount)}</span>
      </span>
    ) : (
      <span className="mll-owner">{entity.owner ?? "Unclaimed"}</span>
    )}
    <RestingGuard entity={entity} />
  </>
);

const RestingGuard = ({ entity }: { entity: MapLabelEntity }) => {
  const guard = restingGuard(entity.guards);
  switch (guard.kind) {
    case "open":
      return <span className="mll-guard">Open</span>;
    case "slot":
      return (
        <span className="mll-guard">
          <Troops troops={guard.slot} />
        </span>
      );
    case "total":
      return (
        <span className="mll-guard">
          <Icon name="defend" size={16} />
          <span className="tabular-nums">{formatCount(guard.total)}</span>
        </span>
      );
  }
};

/** A troop stack, its type shown by its painting: "[crossbow] T3 1,500"; spelled out, "Crossbowman T3 1,500". */
const Troops = ({ troops, spelled = false }: { troops: MapLabelTroops; spelled?: boolean }) => (
  <span className="mll-troops">
    <Icon name={`${troops.type}-t${troops.tier}` as IconMeaning} size={20} />
    {spelled && <span>{TROOP_WORD[troops.type]}</span>}
    <span className="mll-tier">T{troops.tier}</span>
    <span className="tabular-nums">{formatCount(troops.count)}</span>
  </span>
);

/**
 * What the opened plate adds, never what its row says: its name (a realm's level); whose it is where the row shows a
 * reward or an army's home instead of the owner; each guard slot, spelled out, when the row showed only their total.
 */
const OpenLines = ({ entity }: { entity: MapLabelEntity }) => (
  <>
    <div className="mll-plate__more">
      {(entity.army || entity.reward) && (
        <span className="mll-owner">{entity.owner ?? (entity.kind === "rift" ? "Unclaimed" : "Bandits")}</span>
      )}
      <span>{codeName(entity)}</span>
      {entity.kind === "realm" && <span className="opacity-85">· Level {entity.level + 1}</span>}
    </div>
    {entity.guards.length > 1 &&
      entity.guards.map((slot, index) => (
        <div key={index} className="mll-plate__more">
          <Troops troops={slot} spelled />
        </div>
      ))}
  </>
);

const openLines = (entity: MapLabelEntity) => 1 + (entity.guards.length > 1 ? entity.guards.length : 0);

const Pin = ({ entity }: { entity: MapLabelEntity }) => (
  <div className="mll-pin">
    <Icon name={kindIcon(entity)} size={18} />
  </div>
);

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

/** How much a thing's place in the stack is worth: selected, hovered, yours, then what threatens you. */
const PRIORITY: Record<MapLabelEntity["relation"], number> = { own: 60, enemy: 40, ally: 30, neutral: 10 };
const KIND_WEIGHT: Record<MapLabelEntity["kind"], number> = {
  army: 8,
  hyperstructure: 7,
  realm: 5,
  rift: 3,
  camp: 2,
};

const measure = (() => {
  let context: CanvasRenderingContext2D | null = null;
  return (text: string) => {
    context ??= document.createElement("canvas").getContext("2d");
    if (!context) return text.length * 8;
    context.font = '600 15px "Exo 2"';
    return context.measureText(text).width;
  };
})();

/** A plate's box, from the words it will draw and its icons at their fixed widths. */
const plateBox = (item: ProjectedEntity, hovered: string | null, selected: string | null): LabelBox => {
  const { entity } = item;
  const guard = restingGuard(entity.guards);
  const guardWords =
    guard.kind === "open"
      ? "Open"
      : guard.kind === "slot"
        ? `T${guard.slot.tier} ${formatCount(guard.slot.count)}`
        : formatCount(guard.total);
  const words = entity.army
    ? `T${entity.army.troops.tier} ${formatCount(entity.army.troops.count)} ${entity.homeName}`
    : `${entity.reward ? formatCount(entity.reward.amount) : (entity.owner ?? "Unclaimed")} ${guardWords}`;
  const icons = entity.army ? 20 + 16 : 20 + (entity.reward ? 18 : 0) + (guard.kind === "open" ? 0 : 20);
  const width = Math.ceil(measure(words) + icons + 48);
  return {
    id: item.key,
    x: item.x - width / 2,
    y: item.y - PLATE_HEIGHT,
    width,
    height: PLATE_HEIGHT,
    priority:
      (item.key === selected ? 1000 : 0) +
      (item.key === hovered ? 500 : 0) +
      PRIORITY[entity.relation] +
      KIND_WEIGHT[entity.kind],
  };
};

const intersects = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
