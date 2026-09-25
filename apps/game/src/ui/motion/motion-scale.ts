/**
 * The one scale every big moment is tuned on (design §3.11): intensity 0–3 by rarity or size, a speed factor that
 * shortens repeats, and the easing curves. Moments pick values from here; nothing is tuned per screen.
 */
export type Intensity = 0 | 1 | 2 | 3;

export const INTENSITY_LABEL: Record<Intensity, string> = { 0: "Common", 1: "Uncommon", 2: "Rare", 3: "Epic" };

/** World particles per burst, the extra anticipation before a tell, and the Android haptic pattern. */
export const INTENSITY = {
  particles: [12, 24, 48, 96],
  extraHoldMs: [0, 150, 350, 700],
  haptic: [[10], [20], [30, 40, 30], [40, 60, 40, 60, 80]],
  holdAmplitudeDeg: [4, 5, 6, 8],
} as const satisfies Record<string, readonly unknown[]>;

/** Cubic-bezier curves: no moment moves linearly. */
export const EASE = {
  inCubic: [0.32, 0, 0.67, 0],
  outQuart: [0.25, 1, 0.5, 1],
  inOutCubic: [0.65, 0, 0.35, 1],
} as const;

/** The pop spring: scale in with overshoot, about 280 ms. */
export const POP_SPRING = { type: "spring", stiffness: 500, damping: 28 } as const;

/** A counter's roll: 300 + 150·log10(Δ) ms, clamped to 300–1,400, shortened by the repeat speed. */
export const tickDurationMs = (delta: number, speed: number): number => {
  const magnitude = Math.abs(delta);
  const base = magnitude <= 1 ? 300 : 300 + 150 * Math.log10(magnitude);
  return Math.min(1_400, Math.max(300, base)) * speed;
};

const REPEAT_WINDOW_MS = 5 * 60_000;
const REPEAT_SPEED = 0.5;
const recentPlays = new Map<string, number[]>();

/**
 * How fast a moment plays this time: full speed until it has happened twice in five minutes, then half, so the tenth
 * chest costs a fraction of the first. An epic always plays in full.
 */
export const momentSpeed = (moment: string, intensity: Intensity, nowMs: number): number => {
  const plays = (recentPlays.get(moment) ?? []).filter((at) => nowMs - at < REPEAT_WINDOW_MS);
  recentPlays.set(moment, [...plays, nowMs]);
  return intensity === 3 || plays.length < 2 ? 1 : REPEAT_SPEED;
};
