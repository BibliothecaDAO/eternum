import { formatCount, type MapPlate } from "./map-plate-model";
import { plateRows, type PlateSegment } from "./map-plate-rows";

/** A plate's box on screen, in CSS pixels from the map's top left. */
export interface PlateBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Higher keeps its place: the selected and hovered first, then the player's own, then what threatens them. */
  priority: number;
}

const GAP = 3;

const overlaps = (a: PlateBox, b: PlateBox) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP;

/**
 * Stacks overlapping plates instead of covering them: in priority order, each plate rises in steps of its height until
 * it is clear, at most `maxSteps` times; one still overlapping after that is dropped (drawn as a pin). Returns each
 * kept plate's lift.
 */
export const stack = (boxes: readonly PlateBox[], maxSteps = 2): Map<string, number> => {
  const kept: PlateBox[] = [];
  const lifts = new Map<string, number>();
  for (const box of boxes.toSorted((a, b) => b.priority - a.priority)) {
    for (let step = 0; step <= maxSteps; step++) {
      const lifted = { ...box, y: box.y - step * (box.height + GAP) };
      if (kept.some((other) => overlaps(other, lifted))) continue;
      kept.push(lifted);
      lifts.set(box.id, step * (box.height + GAP));
      break;
    }
  }
  return lifts;
};

/** A row's height, the plate's padding and frame, the gap between readings: as map-plates.css draws them. */
const ROW_HEIGHT = 24;
const PLATE_PADDING_Y = 6;
const PLATE_PADDING_X = 6 + 8 + 3 + 1;
const READING_GAP = 6;

const FONTS = {
  body: '600 15px "Exo 2"',
  title: '700 16px "Exo 2"',
  cue: '600 13px "Exo 2"',
  chip: '700 12px "Exo 2"',
} as const;

/** A text's drawn width in one of the plate's faces. */
const measure = (() => {
  let context: CanvasRenderingContext2D | null | undefined;
  return (text: string, font: keyof typeof FONTS) => {
    if (context === undefined)
      context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (!context) return text.length * (font === "cue" ? 7 : 8.5);
    context.font = FONTS[font];
    return context.measureText(text).width;
  };
})();

/** A troop stack's painting, and the tier chip's padding around its letters. */
const TROOP_PAINTING = 20;
/** An army's stamina bar, before its "x/y". */
const STAMINA_BAR = 36;
const CHIP_PADDING = 10;

const segmentWidth = (segment: PlateSegment): number => {
  switch (segment.kind) {
    case "owner":
    case "word":
    case "label":
    case "count":
      return measure(segment.text, "body");
    case "title":
      return measure(segment.text, "title");
    case "cue":
      return measure(segment.text, "cue");
    case "troops":
      return (
        TROOP_PAINTING +
        measure(`T${segment.troops.tier}`, "chip") +
        CHIP_PADDING +
        measure(formatCount(segment.troops.count), "body") +
        2 * 4
      );
    case "stamina":
      return STAMINA_BAR + READING_GAP + measure(`${formatCount(segment.current)}/${formatCount(segment.max)}`, "body");
    case "next":
      return measure("›", "body") + 4;
    case "divider":
      return 1;
  }
};

/** A plate's size, resting or opened, from the rows it draws. */
export const plateSize = (plate: MapPlate, open: boolean): { width: number; height: number } => {
  const rows = plateRows(plate, open);
  const width = Math.max(
    ...rows.map((row) => row.reduce((sum, segment) => sum + segmentWidth(segment), 0) + READING_GAP * (row.length - 1)),
  );
  return {
    width: Math.ceil(width + PLATE_PADDING_X),
    height: rows.length * ROW_HEIGHT + PLATE_PADDING_Y,
  };
};
