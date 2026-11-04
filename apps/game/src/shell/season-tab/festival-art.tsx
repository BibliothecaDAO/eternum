import "./festival.css";

import { useEffect, useRef, type CSSProperties } from "react";

import { DIWALI_SPRITES } from "@/ui/design-system/icon-meaning";

import { drawShow, SHOW_SECONDS, type FireworkColour, type FireworkSheets } from "./fireworks";

/**
 * Diwali's marks for Season 0's end: painted fireworks over the season (a canvas drawing the show of fireworks.ts), a
 * rangoli in the kit's gold line, and painted diyas whose flames breathe. Every mark is still under
 * prefers-reduced-motion.
 */

/**
 * The fireworks: the show plays once as the screen opens, then the sky is left clear. `frame` holds it at that second
 * (the lab's stills); reduced motion holds every burst at its poster frame.
 */
export const FireworkSky = ({ frame, className }: { frame?: number; className?: string }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const sky = canvas.current;
    const context = sky?.getContext("2d");
    if (!sky || !context) return;
    const still = frame ?? (matchMedia("(prefers-reduced-motion: reduce)").matches ? "poster" : undefined);
    let pending = 0;
    let resized: ResizeObserver | undefined;
    let gone = false;
    const play = (sheets: FireworkSheets) => {
      if (gone) return;
      const begun = performance.now();
      const draw = () => {
        fitToScreen(sky);
        if (still !== undefined) return drawShow(context, sheets, sky.width, sky.height, still);
        const seconds = (performance.now() - begun) / 1000;
        drawShow(context, sheets, sky.width, sky.height, seconds);
        if (seconds < SHOW_SECONDS) pending = requestAnimationFrame(draw);
      };
      draw();
      // A still sky is drawn again at its new size; a playing one fits itself each frame.
      resized = new ResizeObserver(() => still !== undefined && draw());
      resized.observe(sky);
    };
    loadSheets().then(play, (error: unknown) => console.error("The Diwali fireworks did not load", error));
    return () => {
      gone = true;
      cancelAnimationFrame(pending);
      resized?.disconnect();
    };
  }, [frame]);
  return <canvas ref={canvas} className={`festival-sky ${className ?? ""}`} aria-hidden />;
};

const COLOURS = Object.keys(DIWALI_SPRITES.fireworks) as FireworkColour[];

let sheets: Promise<FireworkSheets> | undefined;

/** Every firework's sheet, decoded once for every sky; a failed load is tried again by the next sky. */
const loadSheets = () =>
  (sheets ??= Promise.all(
    COLOURS.map(async (colour) => {
      const image = new Image();
      image.src = DIWALI_SPRITES.fireworks[colour].url;
      await image.decode();
      return [colour, image] as const;
    }),
  ).then(
    (loaded) => Object.fromEntries(loaded) as FireworkSheets,
    (error: unknown) => {
      sheets = undefined;
      throw error;
    },
  ));

/** The canvas at the screen's pixels, up to twice its size in CSS pixels. */
const fitToScreen = (sky: HTMLCanvasElement) => {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(sky.clientWidth * scale);
  const height = Math.round(sky.clientHeight * scale);
  if (sky.width !== width || sky.height !== height) Object.assign(sky, { width, height });
};

/**
 * A rangoli: a lotus of eight petals round an eight-pointed star, dotted between, in the kit's gold line. Drawn faint,
 * behind what matters; a card clips it to a corner.
 */
export const Rangoli = ({ size, className }: { size: number; className?: string }) => {
  const petals = Array.from({ length: 8 }, (_, index) => index * 45);
  const dots = Array.from({ length: 16 }, (_, index) => index * 22.5 + 11.25);
  return (
    <svg
      className={`festival-rangoli ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
        <circle r={96} strokeDasharray="2 6" strokeLinecap="round" />
        <circle r={88} />
        {petals.map((turn) => (
          <path
            key={`o${turn}`}
            transform={`rotate(${turn})`}
            d="M0 -84 C 22 -64 22 -44 0 -30 C -22 -44 -22 -64 0 -84 Z"
          />
        ))}
        {petals.map((turn) => (
          <path
            key={`i${turn}`}
            transform={`rotate(${turn + 22.5})`}
            d="M0 -62 C 12 -50 12 -40 0 -32 C -12 -40 -12 -50 0 -62 Z"
          />
        ))}
        <circle r={30} />
        <path d="M0 -26 L7 -7 L26 0 L7 7 L0 26 L-7 7 L-26 0 L-7 -7 Z" />
        <path transform="rotate(45)" d="M0 -26 L7 -7 L26 0 L7 7 L0 26 L-7 7 L-26 0 L-7 -7 Z" />
        <circle r={6} />
      </g>
      <g fill="currentColor">
        {dots.map((turn) => (
          <circle key={turn} transform={`rotate(${turn})`} cy={-72} r={2.4} />
        ))}
      </g>
    </svg>
  );
};

const DIYA = DIWALI_SPRITES.diya;
const DIYA_ROWS = DIYA.frames / DIYA.columns;

/** The diya's sheet as CSS steps it: its grid, a column's and a whole cycle's time, and its poster cell. */
const DIYA_SHEET = {
  backgroundImage: `url(${DIYA.url})`,
  "--diya-columns": DIYA.columns,
  "--diya-rows": DIYA_ROWS,
  "--diya-column-seconds": `${DIYA.columns / DIYA.fps}s`,
  "--diya-cycle-seconds": `${DIYA.frames / DIYA.fps}s`,
  "--diya-sweep-x": `${(DIYA.columns / (DIYA.columns - 1)) * 100}%`,
  "--diya-sweep-y": `${(DIYA_ROWS / (DIYA_ROWS - 1)) * 100}%`,
  "--diya-poster-x": `${((DIYA.posterFrame % DIYA.columns) / (DIYA.columns - 1)) * 100}%`,
  "--diya-poster-y": `${(Math.floor(DIYA.posterFrame / DIYA.columns) / (DIYA_ROWS - 1)) * 100}%`,
} as CSSProperties;

/** A row of lit diyas, each flame a few frames from its neighbour's, all from one decoded sheet. */
export const DiyaRow = ({ count, size }: { count: number; size: number }) => (
  <span className="festival-diyas" aria-hidden>
    {Array.from({ length: count }, (_, index) => (
      <span
        key={index}
        className="festival-diya"
        style={{
          ...DIYA_SHEET,
          width: size,
          height: size,
          animationDelay: `${-((index * 5) % DIYA.frames) / DIYA.fps}s`,
        }}
      />
    ))}
  </span>
);
