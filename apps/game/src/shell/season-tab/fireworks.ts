/**
 * The fireworks over Season 0's end, as a show drawn at any second of it: each shell rises, bursts into sparks that
 * slow, fall and fade, and the show plays its shells four times over. The same second always draws the same sky, so
 * the animation and a still of it are one drawing. Sparks add their light (`lighter`), each a streak with a soft halo.
 */

type Rgb = readonly [number, number, number];

/** The festival's sparks: the kit's gold and spark, a marigold, a rose, Frontier's mist, an emerald, a white heat. */
const GOLD: Rgb = [255, 210, 122];
const MARIGOLD: Rgb = [255, 150, 50];
const ROSE: Rgb = [255, 92, 138];
const MIST: Rgb = [183, 139, 255];
const EMERALD: Rgb = [90, 230, 160];
const HEAT: Rgb = [255, 244, 214];

type Kind = "peony" | "ring" | "willow" | "crackle";

/** A shell, in the sky's own measure: where it bursts (fractions of the sky), when, how wide, and its two colours. */
type Shell = { x: number; y: number; at: number; size: number; kind: Kind; colours: readonly [Rgb, Rgb] };

/** High in the sky and out at its sides, over the head of the card the screen stands at its foot. */
const SHELLS: readonly Shell[] = [
  { x: 0.13, y: 0.2, at: 0.7, size: 0.3, kind: "peony", colours: [GOLD, MARIGOLD] },
  { x: 0.86, y: 0.16, at: 1.15, size: 0.34, kind: "peony", colours: [ROSE, HEAT] },
  { x: 0.5, y: 0.1, at: 1.65, size: 0.24, kind: "ring", colours: [GOLD, HEAT] },
  { x: 0.31, y: 0.08, at: 2.05, size: 0.18, kind: "crackle", colours: [MIST, HEAT] },
  { x: 0.69, y: 0.12, at: 2.4, size: 0.22, kind: "willow", colours: [GOLD, MARIGOLD] },
  { x: 0.95, y: 0.4, at: 2.85, size: 0.17, kind: "peony", colours: [MARIGOLD, GOLD] },
  { x: 0.04, y: 0.45, at: 3.15, size: 0.18, kind: "peony", colours: [EMERALD, HEAT] },
];

/** How each kind of shell bursts: its sparks, their slowing, their fall, their life and their streak. */
const KINDS: Record<Kind, { sparks: number; drag: number; fall: number; life: number; streak: number }> = {
  peony: { sparks: 150, drag: 2.2, fall: 0.1, life: 1.9, streak: 0.16 },
  ring: { sparks: 96, drag: 2.4, fall: 0.08, life: 1.7, streak: 0.14 },
  willow: { sparks: 120, drag: 1.4, fall: 0.16, life: 3.1, streak: 0.45 },
  crackle: { sparks: 110, drag: 2.2, fall: 0.1, life: 1.7, streak: 0.1 },
};

const RISE_SECONDS = 0.7;
const PERIOD_SECONDS = 6.5;
const CYCLES = 4;

/** When the show is over: the last shell's sparks have fallen. */
export const SHOW_SECONDS = PERIOD_SECONDS * (CYCLES - 1) + 3.15 + KINDS.willow.life + 0.6;

/** The moment a still sky is drawn at (reduced motion): most shells open at once. */
export const PEAK_SECONDS = 2.6;

/** A repeatable random: the same seed always gives the same sparks. */
const random = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;

type Sky = { context: CanvasRenderingContext2D; width: number; height: number; unit: number };

/** The sky at `seconds` into the show, on a canvas of `width` × `height` device pixels. */
export const drawShow = (context: CanvasRenderingContext2D, width: number, height: number, seconds: number) => {
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  const sky: Sky = { context, width, height, unit: Math.min(height, width * 0.6) };
  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    SHELLS.forEach((shell, index) => {
      const local = seconds - (cycle * PERIOD_SECONDS + shell.at);
      if (local < -RISE_SECONDS || local > KINDS[shell.kind].life + 0.6) return;
      const placed = placeShell(shell, cycle, index, sky);
      if (local < 0) drawRise(sky, placed, 1 + local / RISE_SECONDS);
      else drawBurst(sky, placed, local, cycle * 97 + index * 13 + 1);
    });
  }
  context.globalCompositeOperation = "source-over";
};

type Placed = Shell & { cx: number; cy: number; reach: number };

/** A shell's burst point this cycle: each cycle shifts it a little, so the show never repeats exactly. */
const placeShell = (shell: Shell, cycle: number, index: number, { width, height, unit }: Sky): Placed => {
  const jitter = random(cycle * 31 + index * 7 + 5);
  return {
    ...shell,
    cx: (shell.x + (cycle ? (jitter() - 0.5) * 0.08 : 0)) * width,
    cy: (shell.y + (cycle ? (jitter() - 0.5) * 0.08 : 0)) * height,
    reach: unit * shell.size,
  };
};

/** The shell on its way up, `progress` from 0 to 1: a bright head and its trail. */
const drawRise = ({ context, height, unit }: Sky, shell: Placed, progress: number) => {
  const eased = 1 - (1 - progress) ** 2;
  const startY = height * 1.05;
  const y = startY + (shell.cy - startY) * eased;
  const trail = unit * 0.09;
  const gradient = context.createLinearGradient(shell.cx, y, shell.cx, y + trail);
  gradient.addColorStop(0, rgba(HEAT, 0.9));
  gradient.addColorStop(1, rgba(shell.colours[0], 0));
  context.strokeStyle = gradient;
  context.lineWidth = Math.max(1, unit * 0.004);
  context.beginPath();
  context.moveTo(shell.cx, y);
  context.lineTo(shell.cx, y + trail);
  context.stroke();
  dot(context, shell.cx, y, unit * 0.005, rgba(HEAT, 1));
};

/** The burst `seconds` after it opened: its flash, then every spark along its path. */
const drawBurst = ({ context, unit }: Sky, shell: Placed, seconds: number, seed: number) => {
  const kind = KINDS[shell.kind];
  if (seconds < 0.2) {
    const flash = context.createRadialGradient(shell.cx, shell.cy, 0, shell.cx, shell.cy, shell.reach * 0.45);
    flash.addColorStop(0, rgba(HEAT, 0.16 * (1 - seconds / 0.2)));
    flash.addColorStop(1, rgba(shell.colours[0], 0));
    context.fillStyle = flash;
    context.fillRect(shell.cx - shell.reach, shell.cy - shell.reach, shell.reach * 2, shell.reach * 2);
  }
  const roll = random(seed);
  const fall = unit * kind.fall;
  for (let index = 0; index < kind.sparks; index += 1) {
    const angle = (index / kind.sparks) * Math.PI * 2 + (roll() - 0.5) * 0.12;
    const spread = shell.kind === "ring" ? 0.95 + roll() * 0.05 : 0.5 + Math.sqrt(roll()) * 0.5;
    const speed = shell.reach * kind.drag * spread;
    const life = kind.life * (0.8 + roll() * 0.35);
    const age = seconds / life;
    const phase = roll() * 40;
    if (age >= 1) continue;
    const at = (time: number) => sparkAt(shell, angle, speed, kind.drag, fall, Math.max(0, time));
    const [x, y] = at(seconds);
    // A slowing spark leaves a longer trail behind it, so its last moments draw an arc, never a dot.
    const [tailX, tailY] = at(seconds - kind.streak * (1 + age * 2.5));
    const colour = age < 0.08 ? HEAT : shell.colours[index % 3 === 0 ? 1 : 0];
    // Sparks brighten as they spread, so the burst's first instant is its flash, never a solid ball.
    const alpha = Math.min(1, seconds / 0.3) * (1 - age) ** 1.4 * twinkle(shell.kind, age, seconds, phase);
    const width = Math.max(1, unit * 0.0045 * (1.3 - age));
    streak(context, tailX, tailY, x, y, width * 3, rgba(colour, alpha * 0.1));
    streak(context, tailX, tailY, x, y, width, rgba(colour, alpha));
    dot(context, x, y, width * 0.9, rgba(HEAT, alpha * 0.8));
  }
};

/** Where a spark is `seconds` after its burst: thrown out, slowed by the air, pulled down. */
const sparkAt = (shell: Placed, angle: number, speed: number, drag: number, fall: number, seconds: number) => {
  const slowed = (1 - Math.exp(-drag * seconds)) / drag;
  return [
    shell.cx + Math.cos(angle) * speed * slowed,
    shell.cy + Math.sin(angle) * speed * slowed + (fall / drag) * (seconds - slowed),
  ] as const;
};

/** A crackle's sparks flicker as they die; every other spark burns steady. */
const twinkle = (kind: Kind, age: number, seconds: number, phase: number) =>
  kind === "crackle" && age > 0.5 ? (Math.sin(seconds * 38 + phase) > 0.2 ? 1.3 : 0.12) : 1;

const streak = (
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  colour: string,
) => {
  context.strokeStyle = colour;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
};

const dot = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, colour: string) => {
  context.fillStyle = colour;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
};
