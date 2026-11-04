import "./festival.css";

import type { CSSProperties } from "react";

import { DEVCON_MARK, REALMS_MARK } from "@/ui/design-system/icon-meaning";

/**
 * Diwali's marks for Season 0's end, drawn in code so they scale to any screen and to the shared image: fireworks over
 * the season, a rangoli in the kit's gold line, and the diya, a small clay lamp (a painted diya from the art lane would
 * replace the drawn one). Every mark is still under prefers-reduced-motion.
 */

/** The festival's sparks: the kit's golds and spark, a marigold, a rose and Frontier's mist. */
const SPARKS = ["#F3D08A", "#FFE45E", "#F4A644", "#F06A8A", "#BB93F9", "#FBE9CD"] as const;

type Burst = { x: number; y: number; r: number; spark: number; delay: number; rays: number };

/** The sky's bursts, in the sky's own 1000 × 600 box, each with its start in the opening's first seconds. */
const BURSTS: readonly Burst[] = [
  { x: 180, y: 150, r: 120, spark: 0, delay: 0, rays: 28 },
  { x: 820, y: 120, r: 140, spark: 3, delay: 0.45, rays: 32 },
  { x: 520, y: 70, r: 90, spark: 1, delay: 0.9, rays: 24 },
  { x: 380, y: 260, r: 70, spark: 4, delay: 1.3, rays: 20 },
  { x: 660, y: 300, r: 80, spark: 2, delay: 1.6, rays: 22 },
  { x: 940, y: 330, r: 60, spark: 5, delay: 2.1, rays: 18 },
  { x: 60, y: 360, r: 65, spark: 3, delay: 2.4, rays: 18 },
];

/**
 * Fireworks over the season: the bursts bloom one after another as the screen opens, then each again every few seconds
 * for a while, and stop. `frame` holds the sky at that second of its opening (the lab's frame strip); `bursts` thins it.
 */
export const FireworkSky = ({
  frame,
  bursts = BURSTS.length,
  className,
}: {
  frame?: number;
  bursts?: number;
  className?: string;
}) => (
  <svg
    className={`festival-sky ${className ?? ""}`}
    viewBox="0 0 1000 600"
    preserveAspectRatio="xMidYMin slice"
    aria-hidden
    data-frame={frame === undefined ? undefined : ""}
    style={frame === undefined ? undefined : ({ "--festival-t": `${frame}s` } as CSSProperties)}
  >
    {BURSTS.slice(0, bursts).map((burst, index) => (
      <FireworkBurst key={index} {...burst} />
    ))}
  </svg>
);

const FireworkBurst = ({ x, y, r, spark, delay, rays }: Burst) => {
  const colour = SPARKS[spark]!;
  const steps = Array.from({ length: rays }, (_, index) => (index / rays) * Math.PI * 2);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="festival-burst" style={{ "--festival-delay": `${delay}s` } as CSSProperties}>
        <circle r={r * 0.55} fill={colour} opacity={0.12} />
        {steps.map((angle, index) => {
          const reach = r * (index % 2 ? 0.78 : 1);
          const [cx, cy] = [Math.cos(angle), Math.sin(angle)];
          return (
            <g key={index}>
              <line
                x1={cx * reach * 0.28}
                y1={cy * reach * 0.28}
                x2={cx * reach * 0.86}
                y2={cy * reach * 0.86}
                stroke={colour}
                strokeWidth={2.2}
                strokeLinecap="round"
                opacity={0.85}
              />
              <circle cx={cx * reach} cy={cy * reach} r={index % 3 ? 2.6 : 3.6} fill={colour} />
            </g>
          );
        })}
        <circle r={5} fill="#FFF6DA" />
      </g>
    </g>
  );
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

/** The season's two hosts, side by side: Realms' lettered mark and Devcon's wordmark. */
export const FestivalLockup = ({ height }: { height: number }) => (
  <span className="festival-lockup" style={{ height }}>
    <img src={REALMS_MARK.lettered} alt="Realms" />
    <span className="festival-lockup__by">×</span>
    <img className="festival-lockup__devcon" src={DEVCON_MARK} alt="Devcon" />
  </span>
);
