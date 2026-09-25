import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { EASE } from "./motion-scale";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";

/**
 * The one full-screen layer the big moments play on: a fixed pool of 96 sprites, never re-rendered by React and moved by
 * transform and opacity only, and the epic flash. Mounted once beside the HUD; the functions below are the only way in.
 */
// An epic chest's 64-coin fountain plus its 24 coins flying home, with room to spare.
const POOL_SIZE = 96;
const SPRITE_PX = 22;
const FLIGHT_MS = 500;
const STAGGER_MS = 18;

type Point = { x: number; y: number };
interface Flight {
  from: Point;
  to: Point | Element;
  icon: string;
  count: number;
  speed?: number;
  /** A pop at the start point before the arc: the reward shows where it was found, then leaves. */
  popMs?: number;
  /** Each sprite's landing, in order: the counter starts its roll on the first and pulses on the rest. */
  onArrive?: (index: number) => void;
}

/** A pooled sprite: an icon, and a label beside it that only a rise shows. */
let pool: HTMLElement[] = [];
const busy = new Set<HTMLElement>();
let flash: HTMLElement | null = null;
/** Flights in the air, so a skipped moment can land them all at once. */
const inFlight = new Set<{ complete: () => void }>();

const dress = (sprite: HTMLElement, icon: string, label: string) => {
  sprite.querySelector("img")!.src = icon;
  sprite.querySelector("span")!.textContent = label;
};

const centreOf = (target: Point | Element): Point => {
  if (!(target instanceof Element)) return target;
  const box = target.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/**
 * Sprites arc from a point to a HUD counter as a stream, 500 ms each, ease-in, 18 ms apart, after an optional pop where
 * they start; `onArrive` runs as each one lands (the counter's roll starts on the first). Reduced motion, or no free
 * sprite, lands the first at once.
 */
export const flySprites = ({ from, to, icon, count, speed = 1, popMs = 0, onArrive }: Flight): void => {
  const free = pool.filter((sprite) => !busy.has(sprite)).slice(0, count);
  if (useWorldAppearanceStore.getState().reducedMotion || free.length === 0) {
    onArrive?.(0);
    return;
  }
  const end = centreOf(to);
  const lift = Math.min(160, Math.abs(end.x - from.x) * 0.3 + 60);
  free.forEach((sprite, index) => {
    busy.add(sprite);
    dress(sprite, icon, "");
    const jitter = (index % 5) * 6 - 12;
    const start = { x: from.x - SPRITE_PX / 2 + jitter, y: from.y - SPRITE_PX / 2 };
    const finish = { x: end.x - SPRITE_PX / 2, y: end.y - SPRITE_PX / 2 };
    const { keyframes, times, ease } = flightPath(start, finish, lift, popMs / (popMs + FLIGHT_MS));
    const flight = animate(sprite, keyframes, {
      duration: ((popMs + FLIGHT_MS) * speed) / 1000,
      delay: (index * STAGGER_MS * speed) / 1000,
      times,
      ease,
    });
    inFlight.add(flight);
    void flight.then(async () => {
      inFlight.delete(flight);
      onArrive?.(index);
      await animate(sprite, { opacity: 0 }, { duration: 0.08 });
      busy.delete(sprite);
    });
  });
};

/** Lands every sprite in the air now: a skipped moment jumps to its end, landings and all. */
export const finishFlights = (): void => {
  for (const flight of [...inFlight]) flight.complete();
};

const FLASH_OPACITY = 0.4;
const FLASH_MS = 240;
const SHAKE_PX = 4;
const SHAKE_MS = 300;

/**
 * The epic's one flash: warm light over the whole screen at no more than 40% opacity, once, far under the three-flash
 * rule. Reduced motion shows none.
 */
export const flashScreen = (): void => {
  if (useWorldAppearanceStore.getState().reducedMotion || !flash) return;
  void animate(flash, { opacity: [0, FLASH_OPACITY, 0] }, { duration: FLASH_MS / 1000, times: [0, 0.25, 1] });
};

/**
 * A 4 px screen shake over 300 ms, easing out. It moves everything marked `data-screen-shake`: the world layer and the
 * map canvas, both full-screen, so nothing reflows. Reduced motion shows none.
 */
export const shakeScreen = (): void => {
  if (useWorldAppearanceStore.getState().reducedMotion) return;
  const offsets = [0, SHAKE_PX, -SHAKE_PX, SHAKE_PX * 0.6, -SHAKE_PX * 0.3, 0];
  for (const element of document.querySelectorAll<HTMLElement>("[data-screen-shake]")) {
    void animate(element, { x: offsets, y: offsets.map((offset) => -offset / 2) }, { duration: SHAKE_MS / 1000 });
  }
};

const FOUNTAIN_MS = 800;
const FOUNTAIN_HEIGHT_PX = 120;

/**
 * Sprites erupt from a point in a fan and fall back past it as they fade, a fountain of coins from an opened chest.
 * Reduced motion, or no free sprites, shows none.
 */
export const fountainSprites = ({ at, icon, count }: { at: Point; icon: string; count: number }): void => {
  if (useWorldAppearanceStore.getState().reducedMotion) return;
  const free = pool.filter((sprite) => !busy.has(sprite)).slice(0, count);
  free.forEach((sprite, index) => {
    busy.add(sprite);
    dress(sprite, icon, "");
    // Spread evenly across a 120° fan, each a little higher or lower than its neighbour.
    const angle = (-60 + (120 * (index + 0.5)) / free.length) * (Math.PI / 180);
    const reach = FOUNTAIN_HEIGHT_PX * (0.7 + ((index * 37) % 10) / 20);
    const start = { x: at.x - SPRITE_PX / 2, y: at.y - SPRITE_PX / 2 };
    const peak = { x: start.x + Math.sin(angle) * reach * 0.6, y: start.y - Math.cos(angle) * reach };
    const land = { x: start.x + Math.sin(angle) * reach, y: start.y + reach * 0.35 };
    void animate(
      sprite,
      { x: [start.x, peak.x, land.x], y: [start.y, peak.y, land.y], opacity: [0, 1, 0], scale: [0.5, 1, 0.8] },
      { duration: FOUNTAIN_MS / 1000, times: [0, 0.4, 1], ease: [EASE.outQuart, EASE.inCubic], delay: index * 0.008 },
    ).then(() => busy.delete(sprite));
  });
};

const RISE_MS = 1_000;
const RISE_PX = 48;
const RISE_POP_SHARE = 0.2;

/**
 * A sprite that pops where something was found and rises 48 px as it fades, with its label beside it: the tile's own
 * beat when nothing on screen receives it. Reduced motion, or no free sprite, shows nothing.
 */
export const riseSprite = ({ at, icon, label }: { at: Point; icon: string; label: string }): void => {
  const sprite = pool.find((candidate) => !busy.has(candidate));
  if (useWorldAppearanceStore.getState().reducedMotion || !sprite) return;
  busy.add(sprite);
  dress(sprite, icon, label);
  const start = { x: at.x - SPRITE_PX / 2, y: at.y - SPRITE_PX / 2 };
  void animate(
    sprite,
    {
      x: [start.x, start.x, start.x],
      y: [start.y, start.y, start.y - RISE_PX],
      opacity: [0, 1, 0],
      scale: [0.6, 1.15, 1],
    },
    { duration: RISE_MS / 1000, times: [0, RISE_POP_SHARE, 1], ease: [EASE.outQuart, EASE.inCubic] },
  ).then(() => busy.delete(sprite));
};

/**
 * The arc from start to finish, rising by `lift` but staying on screen. With a pop share, the sprite first scales in with overshoot where it
 * starts for that share of the time, then takes the arc.
 */
const flightPath = (start: Point, finish: Point, lift: number, popShare: number) => {
  // The apex never leaves the screen, however close to the top edge the counter sits.
  const middle = { x: (start.x + finish.x) / 2, y: Math.max(0, Math.min(start.y, finish.y) - lift) };
  if (popShare === 0) {
    return {
      keyframes: {
        x: [start.x, middle.x, finish.x],
        y: [start.y, middle.y, finish.y],
        opacity: [0, 1, 1],
        scale: [0.6, 1, 0.7],
      },
      times: undefined,
      ease: EASE.inCubic,
    };
  }
  return {
    keyframes: {
      x: [start.x, start.x, middle.x, finish.x],
      y: [start.y, start.y, middle.y, finish.y],
      opacity: [0, 1, 1, 1],
      scale: [0.6, 1.15, 1, 0.7],
    },
    times: [0, popShare, popShare + (1 - popShare) / 2, 1],
    ease: [EASE.outQuart, EASE.inCubic, EASE.inCubic],
  };
};

export const MotionLayer = () => {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pool = Array.from(layer.current?.querySelectorAll<HTMLElement>("[data-sprite]") ?? []);
    flash = layer.current?.querySelector<HTMLElement>("[data-flash]") ?? null;
    return () => {
      pool = [];
      busy.clear();
      inFlight.clear();
      flash = null;
    };
  }, []);
  return (
    <div ref={layer} aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <div data-flash className="absolute inset-0 bg-[#fff1cf] opacity-0" />
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <div
          key={index}
          data-sprite
          className="absolute left-0 top-0 flex items-center gap-1 opacity-0 will-change-transform"
        >
          <img
            alt=""
            // The LORDS token art is a dark coin: a gold rim keeps it reading as a coin on the dark HUD.
            className="drop-shadow-[0_0_3px_rgba(223,170,84,0.95)]"
            style={{ width: SPRITE_PX, height: SPRITE_PX }}
          />
          <span className="whitespace-nowrap font-sans text-sm font-semibold text-gold tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" />
        </div>
      ))}
    </div>
  );
};
