import { DIWALI_SPRITES, type Sprite } from "@/ui/design-system/icon-meaning";

/**
 * The fireworks over Season 0's end, as a show drawn at any second of it: painted bursts (DIWALI_SPRITES), each played
 * once from its opening to its embers, staggered so no two peak together, the show's bursts four times over. The same
 * second always draws the same sky, so the animation and a still of it are one drawing.
 */

export type FireworkColour = keyof typeof DIWALI_SPRITES.fireworks;

/** A burst, in the sky's own measure: its centre (fractions of the sky), when it opens, its width and its colour. */
type Burst = { x: number; y: number; at: number; size: number; colour: FireworkColour };

/** High in the sky and out at its sides, over the head of the card the screen stands at its foot. */
const BURSTS: readonly Burst[] = [
  { x: 0.13, y: 0.14, at: 0.3, size: 0.34, colour: "gold" },
  { x: 0.5, y: 0.07, at: 0.8, size: 0.21, colour: "teal" },
  { x: 0.86, y: 0.12, at: 1.3, size: 0.34, colour: "pink" },
  { x: 0.95, y: 0.38, at: 1.9, size: 0.17, colour: "saffron" },
  { x: 0.04, y: 0.42, at: 2.4, size: 0.17, colour: "teal" },
  { x: 0.69, y: 0.06, at: 2.9, size: 0.22, colour: "gold" },
];

const PERIOD_SECONDS = 4;
const CYCLES = 4;

const playSeconds = ({ frames, fps }: Sprite) => frames / fps;
const lastBurst = BURSTS.reduce(
  (last, burst) => Math.max(last, burst.at + playSeconds(DIWALI_SPRITES.fireworks[burst.colour])),
  0,
);

/** When the show is over: the last burst's embers have faded. */
export const SHOW_SECONDS = PERIOD_SECONDS * (CYCLES - 1) + lastBurst;

/** The sheets, loaded once, each colour's image. */
export type FireworkSheets = Record<FireworkColour, HTMLImageElement>;

/**
 * The sky on a canvas of `width` × `height` device pixels: `moment` seconds into the show, or, for a still sky (reduced
 * motion), every burst held at its poster frame.
 */
export const drawShow = (
  context: CanvasRenderingContext2D,
  sheets: FireworkSheets,
  width: number,
  height: number,
  moment: number | "poster",
) => {
  context.clearRect(0, 0, width, height);
  const unit = Math.min(width, height);
  const draw = (burst: Burst, frame: number, cycle: number) =>
    drawFrame(
      context,
      sheets[burst.colour],
      DIWALI_SPRITES.fireworks[burst.colour],
      frame,
      placed(burst, cycle, width, height, unit),
    );
  if (moment === "poster") {
    BURSTS.forEach((burst) => draw(burst, DIWALI_SPRITES.fireworks[burst.colour].posterFrame, 0));
    return;
  }
  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    for (const burst of BURSTS) {
      const sprite = DIWALI_SPRITES.fireworks[burst.colour];
      const frame = Math.floor((moment - (cycle * PERIOD_SECONDS + burst.at)) * sprite.fps);
      if (frame >= 0 && frame < sprite.frames) draw(burst, frame, cycle);
    }
  }
};

/**
 * A burst's square on the canvas this cycle: each cycle shifts it a little, so the show never repeats exactly, and no
 * burst reaches past the sky's top.
 */
const placed = (burst: Burst, cycle: number, width: number, height: number, unit: number) => {
  const shift = (salt: number) => (cycle ? Math.sin(cycle * 12.9898 + salt * 78.233) * 0.04 : 0);
  const side = unit * burst.size;
  const x = (burst.x + shift(burst.at)) * width - side / 2;
  const y = Math.max(0, (burst.y + shift(burst.at + 1)) * height - side / 2);
  return { x, y, side };
};

const drawFrame = (
  context: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  sprite: Sprite,
  frame: number,
  { x, y, side }: { x: number; y: number; side: number },
) => {
  const cell = sheet.naturalWidth / sprite.columns;
  const column = frame % sprite.columns;
  const row = Math.floor(frame / sprite.columns);
  context.drawImage(sheet, column * cell, row * cell, cell, cell, x, y, side, side);
};
