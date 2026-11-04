import "./festival.css";

import { useEffect, useRef } from "react";

import { drawShow, PEAK_SECONDS, SHOW_SECONDS } from "./fireworks";

/**
 * Diwali's marks for Season 0's end: fireworks over the season (a canvas drawing the show of fireworks.ts), a rangoli
 * in the kit's gold line, and the diya, a small clay lamp. Every mark is still under prefers-reduced-motion.
 */

/**
 * The fireworks: the show plays once as the screen opens, then the sky is left clear. `frame` holds it at that second
 * (the lab's stills); reduced motion holds it at its fullest moment.
 */
export const FireworkSky = ({ frame, className }: { frame?: number; className?: string }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const sky = canvas.current;
    const context = sky?.getContext("2d");
    if (!sky || !context) return;
    const still = frame ?? (matchMedia("(prefers-reduced-motion: reduce)").matches ? PEAK_SECONDS : undefined);
    const begun = performance.now();
    let pending = 0;
    const draw = () => {
      const seconds = still ?? (performance.now() - begun) / 1000;
      fitToScreen(sky);
      drawShow(context, sky.width, sky.height, seconds);
      if (still === undefined && seconds < SHOW_SECONDS) pending = requestAnimationFrame(draw);
    };
    draw();
    // A still sky is drawn again at its new size; a playing one fits itself each frame.
    const resized = new ResizeObserver(() => still !== undefined && draw());
    resized.observe(sky);
    return () => {
      cancelAnimationFrame(pending);
      resized.disconnect();
    };
  }, [frame]);
  return <canvas ref={canvas} className={`festival-sky ${className ?? ""}`} aria-hidden />;
};

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

/** A diya: a clay lamp with its flame lit. */
const Diya = ({ size }: { size: number }) => (
  <svg className="festival-diya" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
    <defs>
      <radialGradient id="diya-glow">
        <stop offset="0" stopColor="#FFE45E" stopOpacity="0.55" />
        <stop offset="1" stopColor="#FFE45E" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="diya-clay" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#D8743A" />
        <stop offset="1" stopColor="#7A2E10" />
      </linearGradient>
      <linearGradient id="diya-flame" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#FFF6DA" />
        <stop offset="0.45" stopColor="#FFE45E" />
        <stop offset="1" stopColor="#F4A644" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="22" r="20" fill="url(#diya-glow)" />
    <path className="festival-diya__flame" d="M32 6 C 38 15 38 22 32 27 C 26 22 26 15 32 6 Z" fill="url(#diya-flame)" />
    <path d="M6 34 C 14 33 50 33 60 30 C 56 44 46 52 32 52 C 18 52 9 45 6 34 Z" fill="url(#diya-clay)" />
    <path d="M8 34 C 18 37 46 37 59 31" fill="none" stroke="#F3D08A" strokeWidth="1.6" opacity="0.8" />
    <circle cx="22" cy="43" r="1.6" fill="#F3D08A" />
    <circle cx="32" cy="45" r="1.6" fill="#F3D08A" />
    <circle cx="42" cy="43" r="1.6" fill="#F3D08A" />
  </svg>
);

/** A row of lit diyas. */
export const DiyaRow = ({ count, size }: { count: number; size: number }) => (
  <span className="festival-diyas" aria-hidden>
    {Array.from({ length: count }, (_, index) => (
      <Diya key={index} size={size} />
    ))}
  </span>
);
