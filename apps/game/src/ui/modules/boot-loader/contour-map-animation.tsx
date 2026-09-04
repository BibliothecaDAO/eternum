import clsx from "clsx";
import { useId, useMemo } from "react";

// ─── Simplex 2D noise (self-contained, zero deps) ───────────────────────────
// Based on Stefan Gustavson's simplex noise. Produces values in [-1, 1].

const GRAD2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Build a deterministic permutation table from any integer seed. */
const buildPerm = (seed: number): Uint8Array => {
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  let s = Math.abs(seed | 0) || 1;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
};

const dot2 = (g: (typeof GRAD2)[number], x: number, y: number) => g[0] * x + g[1] * y;

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const simplex2 = (perm: Uint8Array, xin: number, yin: number): number => {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);

  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    n0 = t0 * t0 * dot2(GRAD2[perm[ii + perm[jj]] % 8], x0, y0);
  }

  let n1 = 0;
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    n1 = t1 * t1 * dot2(GRAD2[perm[ii + i1 + perm[jj + j1]] % 8], x1, y1);
  }

  let n2 = 0;
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    n2 = t2 * t2 * dot2(GRAD2[perm[ii + 1 + perm[jj + 1]] % 8], x2, y2);
  }

  return 70 * (n0 + n1 + n2);
};

// ─── Flow field generation ───────────────────────────────────────────────────

const VIEW_WIDTH = 1440;
const VIEW_HEIGHT = 900;
const NOISE_SCALE = 0.0018;
const STEP_SIZE = 12;
const DRIFT_GROUPS = ["a", "b", "c", "d", "e"] as const;

type FlowLine = {
  path: string;
  strokeWidth: number;
  opacity: number;
  animDelay: number;
  driftGroup: string;
  isShort: boolean;
};

/** Seeded pseudo-random for deterministic visual properties */
const srand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Trace a single flow line through the noise field.
 */
const traceFlowLine = (perm: Uint8Array, sx: number, sy: number, steps: number, scale: number): string => {
  const points: [number, number][] = [[sx, sy]];
  let x = sx;
  let y = sy;

  for (let i = 0; i < steps; i++) {
    const angle =
      simplex2(perm, x * scale, y * scale) * Math.PI * 2.2 +
      simplex2(perm, x * scale * 2.1 + 100, y * scale * 2.1 + 100) * Math.PI * 0.6;

    x += Math.cos(angle) * STEP_SIZE;
    y += Math.sin(angle) * STEP_SIZE;
    points.push([x, y]);

    if (x < -300 || x > VIEW_WIDTH + 300 || y < -300 || y > VIEW_HEIGHT + 300) break;
  }

  if (points.length < 3) return "";

  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;

  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(points.length - 1, i + 1)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }

  return d;
};

const generateFlowField = (seed: number): FlowLine[] => {
  const perm = buildPerm(seed);
  const lines: FlowLine[] = [];

  // Main flow lines
  for (let i = 0; i < 35; i++) {
    const s = i * 3.17 + 0.5;
    const rand = srand(s);

    const sx = -100 + srand(s + 10) * (VIEW_WIDTH * 0.3);
    const sy = (i / 35) * (VIEW_HEIGHT + 200) - 100;
    const steps = 60 + Math.floor(rand * 50);

    const path = traceFlowLine(perm, sx, sy, steps, NOISE_SCALE);
    if (!path) continue;

    lines.push({
      path,
      strokeWidth: 0.5 + rand * 1.3,
      opacity: 0.08 + srand(s + 2) * 0.32,
      animDelay: -(i * 1.1 + srand(s + 3) * 5),
      driftGroup: DRIFT_GROUPS[i % DRIFT_GROUPS.length],
      isShort: false,
    });
  }

  // Short accent/particle lines
  for (let i = 0; i < 18; i++) {
    const s = i * 5.3 + 200;
    const rand = srand(s);

    const sx = srand(s + 10) * VIEW_WIDTH;
    const sy = srand(s + 11) * VIEW_HEIGHT;
    const steps = 15 + Math.floor(rand * 20);

    const path = traceFlowLine(perm, sx, sy, steps, NOISE_SCALE * 1.4);
    if (!path) continue;

    lines.push({
      path,
      strokeWidth: 0.3 + rand * 0.5,
      opacity: 0.05 + srand(s + 3) * 0.14,
      animDelay: -(i * 2.1 + srand(s + 4) * 6),
      driftGroup: DRIFT_GROUPS[(i + 2) % DRIFT_GROUPS.length],
      isShort: true,
    });
  }

  return lines;
};

// ─── Component ───────────────────────────────────────────────────────────────

type ContourMapAnimationProps = {
  className?: string;
};

export const ContourMapAnimation = ({ className }: ContourMapAnimationProps) => {
  const vignetteId = `${useId()}-boot-vignette`;
  const glowId = `${useId()}-boot-glow`;
  // Seed from timestamp — unique flow field every page load
  const lines = useMemo(() => generateFlowField(Date.now()), []);

  return (
    <div className={clsx("boot-loader-contours absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id={vignetteId} cx="50%" cy="48%" r="70%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
          </radialGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(201,169,96,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="1440" height="900" fill="transparent" />
        <rect x="0" y="0" width="1440" height="900" fill={`url(#${glowId})`} />

        {lines.map((line, index) => (
          <g key={index} className={`boot-loader-contour-group boot-loader-contour-group-${line.driftGroup}`}>
            <path
              d={line.path}
              className={clsx("boot-loader-contour-line", line.isShort && "boot-loader-contour-particle")}
              style={{
                animationDelay: `${line.animDelay}s`,
                opacity: line.opacity,
                strokeWidth: line.strokeWidth,
              }}
            />
            {!line.isShort && (
              <path
                d={line.path}
                className="boot-loader-contour-line boot-loader-contour-line-echo"
                style={{
                  transform: `translateY(${6 + srand(index * 13) * 10}px)`,
                  animationDelay: `${line.animDelay - 2}s`,
                  opacity: line.opacity * 0.35,
                  strokeWidth: line.strokeWidth * 0.6,
                }}
              />
            )}
          </g>
        ))}

        <rect x="0" y="0" width="1440" height="900" fill={`url(#${vignetteId})`} />
      </svg>
      <div className="boot-loader-grid absolute inset-0" />
    </div>
  );
};
