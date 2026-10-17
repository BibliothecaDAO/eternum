import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";

import { stack, type LabelBox } from "./map-label-layout";
import { codeName, formatCount, guardLine, standingOf, troopStrength, type Standing } from "./map-label-reading";

/**
 * The owner's pick (round 2): plates that open, compact. At rest each plate answers one glance: an army's tier, troops
 * and stamina; a structure's owner and guard; a camp's or rift's reward and guard. Every guard and every other army is
 * weighed against the viewer's strongest army (stronger, even, weaker, open). A hover opens the plate by one line: whose
 * it is and its short name. Plates that meet stack upward, two steps at most, then drop to a pin.
 */
export const PLATE_RULES = {
  rest: "Army: tier, troops, stamina bar. Realm and hyperstructure: owner, then the guard (one slot “T3 1,500”; several “T1 T1 T1 T3 2,000”), or Open. Camp and rift: its reward, then its guard.",
  standing:
    "Each guard and each other army is weighed against your strongest army: ▲ stronger (red), = even (amber), ▼ weaker (green), Open (green).",
  hover:
    "The plate opens by one line: whose it is and its short name (“Camp 19·21”); a structure with several guard slots, each slot's count.",
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
  mine,
}: {
  items: readonly ProjectedEntity[];
  hovered: string | null;
  selected: string | null;
  /** The viewer's strongest army: the yardstick of every standing. */
  mine: number;
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
              zIndex: item.key === open?.key ? 5 : undefined,
            }}
          >
            {lift === undefined ? (
              <Pin entity={item.entity} />
            ) : (
              <Plate entity={item.entity} mine={mine} open={item.key === open?.key} />
            )}
          </div>
        );
      })}
    </>
  );
};

const PLATE_HEIGHT = 24;
const OPEN_LINE = 20;

/** The plate: its one-glance facts; opened, one line more above them (two for several guard slots). */
const Plate = ({ entity, mine, open }: { entity: MapLabelEntity; mine: number; open: boolean }) => (
  <div className="mll-plate" data-open={open}>
    {open && <OpenLines entity={entity} />}
    <div className="mll-plate__row">
      {entity.army ? <ArmyFacts entity={entity} mine={mine} /> : <StructureFacts entity={entity} mine={mine} />}
    </div>
    {entity.army && (
      <span className="mll-plate__meter" title="Stamina">
        <i style={{ width: `${(100 * entity.army.stamina) / entity.army.staminaMax}%` }} />
      </span>
    )}
  </div>
);

const ArmyFacts = ({ entity, mine }: { entity: MapLabelEntity; mine: number }) => {
  const troops = entity.army!.troops;
  return (
    <>
      <Icon name={`knight-t${troops.tier}` as IconMeaning} size={18} />
      <span className="mll-tier">T{troops.tier}</span>
      <span className="tabular-nums">{formatCount(troops.count)}</span>
      {entity.relation !== "own" && <StandingMark standing={standingOf(troopStrength([troops]), mine)} />}
    </>
  );
};

const StructureFacts = ({ entity, mine }: { entity: MapLabelEntity; mine: number }) => (
  <>
    <Icon name={kindIcon(entity)} size={18} />
    {entity.reward ? (
      <span className="mll-reward">
        <Icon name={resourceMeaning(entity.reward.resource)} size={16} />
        <span className="tabular-nums">{formatCount(entity.reward.amount)}</span>
      </span>
    ) : (
      <span className="mll-owner">{entity.owner ?? "Unclaimed"}</span>
    )}
    <GuardChip entity={entity} mine={mine} />
  </>
);

/** The guard, tier before number, in the colour of its standing (yours plain). */
const GuardChip = ({ entity, mine }: { entity: MapLabelEntity; mine: number }) => {
  const line = guardLine(entity.guards);
  const standing = entity.relation === "own" ? null : standingOf(troopStrength(entity.guards), mine);
  if (!line)
    return (
      <span className="mll-guard" data-standing="open">
        Open
      </span>
    );
  return (
    <span className="mll-guard" data-standing={standing ?? undefined}>
      {line.tiers.map((tier, index) => (
        <span key={index} className="mll-guard__tier">
          {tier}
        </span>
      ))}
      <span className="tabular-nums">{line.total}</span>
      {standing && <Glyph standing={standing} />}
    </span>
  );
};

const StandingMark = ({ standing }: { standing: Standing }) => (
  <span className="mll-guard" data-standing={standing}>
    <Glyph standing={standing} />
  </span>
);

const GLYPH: Record<Standing, string> = { stronger: "▲", even: "=", weaker: "▼", open: "" };

const Glyph = ({ standing }: { standing: Standing }) =>
  GLYPH[standing] ? <span aria-label={standing}>{GLYPH[standing]}</span> : null;

/**
 * What a hover adds: whose it is (an army's; a structure's row already says) and its name; for several guard slots,
 * each slot's count.
 */
const OpenLines = ({ entity }: { entity: MapLabelEntity }) => (
  <>
    <div className="mll-plate__more">
      {(entity.army || entity.reward) && (
        <span className="mll-owner">{entity.owner ?? (entity.kind === "rift" ? "Unclaimed" : "Bandits")}</span>
      )}
      <span className="opacity-85">{codeName(entity)}</span>
      {entity.kind === "realm" && <span className="opacity-85">· Level {entity.level + 1}</span>}
    </div>
    {entity.guards.length > 1 && (
      <div className="mll-plate__more tabular-nums opacity-90">
        {entity.guards.map((slot) => `T${slot.tier} ${formatCount(slot.count)}`).join(" · ")}
      </div>
    )}
  </>
);

const openLines = (entity: MapLabelEntity) => 1 + (entity.guards.length > 1 ? 1 : 0);

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
    context.font = '600 14px "Exo 2"';
    return context.measureText(text).width;
  };
})();

/** A plate's box, from the words it will draw (icons and chips at their fixed widths). */
const plateBox = (item: ProjectedEntity, hovered: string | null, selected: string | null): LabelBox => {
  const { entity } = item;
  const icons = 18 + (entity.reward ? 16 : 0);
  const line = guardLine(entity.guards);
  const words = entity.army
    ? `T${entity.army.troops.tier} ${formatCount(entity.army.troops.count)} ▲`
    : [
        entity.reward ? formatCount(entity.reward.amount) : (entity.owner ?? "Unclaimed"),
        line ? `${line.tiers.join(" ")} ${line.total} ▲` : "Open",
      ].join(" ");
  const chips = entity.army ? 14 : 10 + (line?.tiers.length ?? 0) * 8;
  const width = Math.ceil(measure(words) + icons + chips + 26);
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
