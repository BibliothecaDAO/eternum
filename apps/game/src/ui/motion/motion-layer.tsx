import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { EASE } from "./motion-scale";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";

/**
 * The one full-screen layer the big moments fly sprites on: a fixed pool of 32 images, never re-rendered by React,
 * moved by transform and opacity only. Mounted once by the HUD; `flySprites` is the only way in.
 */
const POOL_SIZE = 32;
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

let pool: HTMLImageElement[] = [];
const busy = new Set<HTMLImageElement>();

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
    sprite.src = icon;
    const jitter = (index % 5) * 6 - 12;
    const start = { x: from.x - SPRITE_PX / 2 + jitter, y: from.y - SPRITE_PX / 2 };
    const finish = { x: end.x - SPRITE_PX / 2, y: end.y - SPRITE_PX / 2 };
    const { keyframes, times, ease } = flightPath(start, finish, lift, popMs / (popMs + FLIGHT_MS));
    void animate(sprite, keyframes, {
      duration: ((popMs + FLIGHT_MS) * speed) / 1000,
      delay: (index * STAGGER_MS * speed) / 1000,
      times,
      ease,
    }).then(async () => {
      onArrive?.(index);
      await animate(sprite, { opacity: 0 }, { duration: 0.08 });
      busy.delete(sprite);
    });
  });
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
    pool = Array.from(layer.current?.querySelectorAll("img") ?? []);
    return () => {
      pool = [];
      busy.clear();
    };
  }, []);
  return (
    <div ref={layer} aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <img
          key={index}
          alt=""
          // The LORDS token art is a dark coin: a gold rim keeps it reading as a coin on the dark HUD.
          className="absolute left-0 top-0 opacity-0 drop-shadow-[0_0_3px_rgba(223,170,84,0.95)] will-change-transform"
          style={{ width: SPRITE_PX, height: SPRITE_PX }}
        />
      ))}
    </div>
  );
};
