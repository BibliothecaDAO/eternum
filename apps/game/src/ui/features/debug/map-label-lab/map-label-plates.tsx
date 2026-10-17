import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import type { MapLabelEntity, MapLabelTroops } from "@/three/debug/map-label-lab-fixture";

import { stack, type LabelBox } from "./map-label-layout";
import { attackOrder, formatCount, homeCode, restingGuard } from "./map-label-reading";

/**
 * The owner's pick (rounds 2 to 4 and their amendments): plates that open. A painting only where it reads faster than a
 * word (troop type, resource, the open lock); a place's name set as a title, a player's in the side's colour. At rest:
 * a realm's name and its one guard number; an army's owner over its troops and stamina; a camp's or rift's reward and
 * guard. Hovering the tile a thing stands on opens its plate upward, adding only what the plate does not say. Plates
 * that meet stack upward, two steps at most, then drop to a pin.
 */
export const PLATE_RULES = {
  rest: "Realm: its name (title), then one guard number: a single slot as its troop painting, tier and count; several as their total; none, an open lock. Hyperstructure, camp, rift: its painting (a camp or rift, its reward), then its guard. Army: its owner, above its troops and stamina bar.",
  hover:
    "Hover the tile: the plate opens with what it does not say at rest. A structure: its owner (in the side's colour) and level or id; its guard slots on one line, the first an attacker meets first. An army, inline in its own shape: owner and home realm, then id and troops (one line when it fits).",
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
      x: open.x - openedWidth(open.entity, openBox.width) / 2,
      y: openBox.y - (lifts.get(openBox.id) ?? 0) - OPEN_LINE * openLines(open.entity),
      width: openedWidth(open.entity, openBox.width),
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
            data-entity={item.key}
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

const ROW_HEIGHT = 30;
const NAME_LINE = 22;
const OPEN_LINE = 24;

/** The plate: a structure's row, opened with what the row does not hold above it; or an army's plate. */
const Plate = ({ entity, open }: { entity: MapLabelEntity; open: boolean }) =>
  entity.army ? (
    <ArmyPlate entity={entity} open={open} />
  ) : (
    <div className="mll-plate" data-open={open}>
      {open && <OpenLines entity={entity} />}
      <div className="mll-plate__row">
        <StructureRow entity={entity} />
      </div>
    </div>
  );

/**
 * An army keeps one shape: its owner over its troops, the stamina bar at its foot. Opened, the same two lines carry more,
 * inline: the owner and the realm it comes from, then its id and its troops; on one line when that fits.
 */
const ArmyPlate = ({ entity, open }: { entity: MapLabelEntity; open: boolean }) => {
  const army = entity.army!;
  const owner = <span className="mll-owner">{entity.owner}</span>;
  const home = <span className="mll-title">{entity.homeName}</span>;
  const id = <span className="mll-muted">{homeCode(entity)}</span>;
  const troops = <Troops troops={army.troops} />;
  return (
    <div className="mll-plate" data-open={open}>
      {!open ? (
        <>
          <div className="mll-plate__name">{owner}</div>
          <div className="mll-plate__row">{troops}</div>
        </>
      ) : armyFitsOneLine(entity) ? (
        <div className="mll-plate__row">
          {owner}
          {home}
          {id}
          {troops}
        </div>
      ) : (
        <>
          <div className="mll-plate__name">
            {owner}
            {home}
          </div>
          <div className="mll-plate__row">
            {id}
            {troops}
          </div>
        </>
      )}
      <span className="mll-plate__meter" title="Stamina">
        <i style={{ width: `${(100 * army.stamina) / army.staminaMax}%` }} />
      </span>
    </div>
  );
};

/** The widest opened army that still reads as one line at play zoom. */
const ONE_LINE_WIDTH = 360;

/** An opened army's two halves (owner and home; id and troops), each as drawn: its words, paintings, gaps, padding. */
const openedArmyHalves = (entity: MapLabelEntity) => {
  const troops = entity.army!.troops;
  return [
    measure(`${entity.owner} `) + measure(entity.homeName, true) + 2 * 6 + 8,
    measure(`${homeCode(entity)} T${troops.tier} ${formatCount(troops.count)}`) + 20 + 4 * 6,
  ];
};

const armyFitsOneLine = (entity: MapLabelEntity) => {
  const [first, second] = openedArmyHalves(entity);
  return first + second + 20 <= ONE_LINE_WIDTH;
};

/** How wide a plate stands once opened: an army as its inline layout; a structure as at rest, its lines fit within. */
const openedWidth = (entity: MapLabelEntity, restingWidth: number) => {
  if (!entity.army) return Math.max(restingWidth, entity.guards.length > 1 ? entity.guards.length * 96 : 0);
  const [first, second] = openedArmyHalves(entity);
  return (armyFitsOneLine(entity) ? first + second : Math.max(first, second)) + 20;
};

/** A structure: its reward (a camp or a rift) or its owner, then one guard number. */
/** A structure: a realm by its name; a nameless one by its painting (a camp or a rift, with its reward); then its guard. */
const StructureRow = ({ entity }: { entity: MapLabelEntity }) => (
  <>
    {entity.kind === "realm" ? (
      <span className="mll-title">{entity.name}</span>
    ) : (
      <Icon name={kindIcon(entity)} size={20} />
    )}
    {entity.reward && (
      <span className="mll-reward">
        <Icon name={resourceMeaning(entity.reward.resource)} size={18} />
        <span className="tabular-nums">{formatCount(entity.reward.amount)}</span>
      </span>
    )}
    <RestingGuard entity={entity} />
  </>
);

const RestingGuard = ({ entity }: { entity: MapLabelEntity }) => {
  const guard = restingGuard(entity.guards);
  switch (guard.kind) {
    case "open":
      return (
        <span className="mll-guard">
          <Icon name="unlock" size={18} alt="Open" />
        </span>
      );
    case "slot":
      return (
        <span className="mll-guard">
          <Troops troops={guard.slot} />
        </span>
      );
    case "total":
      return <span className="mll-guard tabular-nums">{formatCount(guard.total)}</span>;
  }
};

/** A troop stack, its type shown by its painting: "[crossbow] T3 1,500". */
const Troops = ({ troops }: { troops: MapLabelTroops }) => (
  <span className="mll-troops">
    <Icon name={`${troops.type}-t${troops.tier}` as IconMeaning} size={20} />
    <span className="mll-tier">T{troops.tier}</span>
    <span className="tabular-nums">{formatCount(troops.count)}</span>
  </span>
);

/**
 * What an opened structure adds, never what its row says: whose it is, in the side's colour (bandits, or nobody), and a
 * realm's level or a nameless thing's id; and when the row showed only their total, its guard slots on one line, in the
 * order an attacker meets them.
 */
const OpenLines = ({ entity }: { entity: MapLabelEntity }) => (
  <>
    <div className="mll-plate__more">
      <span className="mll-owner">{entity.owner ?? (entity.kind === "camp" ? "Bandits" : "Unclaimed")}</span>
      <span className="mll-muted">{entity.kind === "realm" ? `Level ${entity.level + 1}` : homeCode(entity)}</span>
    </div>
    {entity.guards.length > 1 && (
      <div className="mll-plate__more" aria-label="Guards, first met first">
        {attackOrder(entity.guards).map((slot, index) => (
          <span key={index} className="mll-troops">
            {index > 0 && <span className="mll-next">›</span>}
            <Troops troops={slot} />
          </span>
        ))}
      </div>
    )}
  </>
);

/** An opened structure's lines above its row; an army opens within its own two lines. */
const openLines = (entity: MapLabelEntity) => (entity.army ? 0 : 1 + (entity.guards.length > 1 ? 1 : 0));

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

/** A text's drawn width: in the plate's face, or as a title (a place's name in Cinzel). */
const measure = (() => {
  let context: CanvasRenderingContext2D | null = null;
  return (text: string, title = false) => {
    context ??= document.createElement("canvas").getContext("2d");
    if (!context) return text.length * (title ? 10 : 8);
    context.font = title ? '700 16px "Cinzel"' : '600 15px "Exo 2"';
    return context.measureText(text).width;
  };
})();

/** A plate's box, from the words it will draw and its icons at their fixed widths. */
const plateBox = (item: ProjectedEntity, hovered: string | null, selected: string | null): LabelBox => {
  const { entity } = item;
  const guard = restingGuard(entity.guards);
  const guardWords =
    guard.kind === "open"
      ? ""
      : guard.kind === "slot"
        ? `T${guard.slot.tier} ${formatCount(guard.slot.count)}`
        : formatCount(guard.total);
  const words = entity.army
    ? `T${entity.army.troops.tier} ${formatCount(entity.army.troops.count)}`
    : `${entity.reward ? formatCount(entity.reward.amount) : ""} ${guardWords}`;
  const icons = entity.army
    ? 20
    : (entity.kind === "realm" ? 0 : 20) + (entity.reward ? 18 : 0) + (guard.kind === "total" ? 0 : 20);
  const title = entity.kind === "realm" ? measure(entity.name, true) : 0;
  const width = Math.ceil(Math.max(measure(words) + title + icons, entity.army ? measure(entity.owner ?? "") : 0) + 48);
  const height = ROW_HEIGHT + (entity.army ? NAME_LINE : 0);
  return {
    id: item.key,
    x: item.x - width / 2,
    y: item.y - height,
    width,
    height,
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
