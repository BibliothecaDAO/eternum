import { formatExact } from "@bibliothecadao/types";
import { CLASSIC_HUD_FONTS, HUD_TYPE } from "@/tokens";

import { type MapPlate } from "./map-plate-model";
import { plateRows, restingStamina, type PlateSegment } from "./map-plate-rows";

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
/** An army's resting stamina bar under its rows: its height and margins (map-plates.css .mp-plate__stamina). */
const RESTING_STAMINA = 3 + 1 + 2;

/** The plate's faces, as map-plates.css draws them from the HUD sheet: every reading at the body size, told by weight. */
const face = (role: keyof typeof HUD_TYPE, weight: keyof typeof HUD_TYPE = role) =>
  `${HUD_TYPE[weight].weight} ${HUD_TYPE[role].size} ${CLASSIC_HUD_FONTS.ui}`;
const FONTS = {
  body: face("body"),
  title: face("body", "title"),
  count: face("body", "strong"),
  chip: face("label"),
} as const;

/** A text's drawn width in one of the plate's faces. */
const measure = (() => {
  let context: CanvasRenderingContext2D | null | undefined;
  return (text: string, font: keyof typeof FONTS) => {
    if (context === undefined)
      context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (!context) return text.length * 8;
    context.font = FONTS[font];
    return context.measureText(text).width;
  };
})();

/** A troop stack's painting, and the sheet chip's padding and border around its letters (hud-sheet.css .ui-chip). */
const TROOP_PAINTING = 20;
/** An opened army's stamina bar at its shortest, before its "x/y" (it stretches to the plate's width). */
const STAMINA_BAR = 36;
const CHIP_PADDING = 2 * 6 + 2;

const segmentWidth = (segment: PlateSegment): number => {
  switch (segment.kind) {
    case "label":
    case "cue":
      return measure(segment.text, "body");
    case "owner":
    case "word":
    case "title":
      return measure(segment.text, "title");
    case "count":
      return measure(segment.text, "count");
    case "troops":
      return (
        TROOP_PAINTING +
        measure(`T${segment.troops.tier}`, "chip") +
        CHIP_PADDING +
        measure(formatExact(segment.troops.count), "count") +
        2 * 4
      );
    case "stamina":
      return STAMINA_BAR + READING_GAP + measure(`${formatExact(segment.current)}/${formatExact(segment.max)}`, "body");
    case "next":
      return measure("›", "count") + 4;
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
    height: rows.length * ROW_HEIGHT + PLATE_PADDING_Y + (restingStamina(plate, open) === null ? 0 : RESTING_STAMINA),
  };
};
