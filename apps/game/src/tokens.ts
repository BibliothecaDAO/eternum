/**
 * The one token file: every visual value the shell (src/shell, the doorway, src/pwa and the kit) renders with, and the
 * HUD's palette and finish beside it. Tailwind reads it (tailwind.config.js) and writes each value as a CSS variable,
 * so classes, index.css and code that cannot take a class read the same values. The brand's colours are the brand kit's
 * own palette (src/brand/palette.json, Realms Brand Kit v3, unchanged): a role the kit names reads it from there.
 *
 * How to restyle the shell
 *
 * - Change a value here, never in a component or in index.css. `pnpm shell:check` refuses one-off colours, sizes,
 *   radii, shadows and gradients in the shell's code and literal values in the stylesheet classes it renders;
 *   `pnpm hud:check` refuses any look of the HUD's own beside its sheet, and counts down what the migration has left.
 * - The shell and the HUD are two surfaces. The HUD reads `HUD_COLORS` and `HUD_FINISH` (on :root); the shell reads
 *   `SHELL_COLORS` and `SHELL_FINISH` (under `data-surface="shell"`, which PageFrame, the doorway and the install sheet
 *   set). The `kit-*` classes and index.css's shared classes (the primary button, sheet, chip, card, plate, painted
 *   card and leather) resolve to whichever surface they render in, so a shell value never moves a HUD pixel and
 *   a HUD value never moves a shell pixel.
 * - Faces (`FONTS`), the type scale, radii, widths, gutters, the spacing scale and screens are one set for the whole
 *   app: the HUD's kit components (a Button, a Panel) follow them too.
 * - /lab/kit/tokens draws every value from this file; /lab/app and /lab/kit show it in place.
 */

import KIT from "./brand/palette.json";

/** The brand kit's colours (Realms Brand Kit v3 `03-Colors/palette.json`), lower-cased as the rest of this file. */
const BRAND = Object.fromEntries(Object.entries(KIT.brand).map(([name, hex]) => [name, hex.toLowerCase()])) as {
  readonly [name in keyof typeof KIT.brand]: string;
};

/** `r g b` channels of a `#rrggbb` colour: the form Tailwind's `rgb(var(--kit-x) / <alpha-value>)` classes read. */
const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(" ");

/** `rgb(r g b / alpha)` of a `#rrggbb` colour, so a shadow or a gradient follows its colour token. */
const withAlpha = (hex: string, alpha: number) => `rgb(${channels(hex)} / ${alpha})`;

/** The HUD's palette: the in-game interface, and :root's (`--ground`, `bg-kit-ground` outside the shell). */
export const HUD_COLORS = {
  /** Every page's background, the install splash, the status bar. */
  ground: BRAND.hearth,
  /** Cards and plates, always opaque. */
  plate: BRAND.plate,
  /** A secondary button's face, a pressed row. */
  plate2: "#2a221c",
  /** Card edges and separators; never text. */
  line: BRAND.line,
  /** Chip and outline-button edges; never text. */
  line2: "#6b5230",
  /** Text, and the logo on dark. */
  cream: BRAND.cream,
  /** Secondary text. */
  muted: BRAND.muted,
  /** Earned and press-me: the primary button's face, a place or LORDS won. */
  gold: BRAND["action-gold"],
  /** The lit rim, the ending line. */
  gold2: BRAND["mark-gold"],
  /** The brand accent: the selected tab, focus rings, the age numerals, the player's own row. */
  peach: "#f6c297",
  /** Warning: the last hour, a full store, Blocked. */
  amber: "#e39001",
  /** At the limit: the kit's ember tone, a refusal notice's edge, a slider's stop. */
  ember: "#ef5858",
  /** A failure line, a field in error. */
  red: "#fc4c4c",
  /** Live: a game under way. */
  sage: "#b5bd75",
  /** The HUD's warning glow, nothing else. */
  hot: "#f6ac1d",
  /** Text on a gold face. */
  ink: "#1b1207",
  /** A chip's dark glass, always translucent (72%): the HUD's chip token and the shell's state pills. */
  veil: "#0a0806",
  /** Shadows and recesses (a key hint's well); never a surface. */
  shade: "#000000",
} as const;

type Palette = { readonly [name in keyof typeof HUD_COLORS]: string };

/** The shell's palette: every page outside a game. Same roles as the HUD's; today the same values. */
export const SHELL_COLORS: Palette = {
  ground: BRAND.hearth,
  plate: BRAND.plate,
  plate2: "#2a221c",
  line: BRAND.line,
  line2: "#6b5230",
  cream: BRAND.cream,
  muted: BRAND.muted,
  gold: BRAND["action-gold"],
  gold2: BRAND["mark-gold"],
  peach: "#f6c297",
  amber: "#e39001",
  ember: "#ef5858",
  red: "#fc4c4c",
  sage: "#b5bd75",
  hot: "#f6ac1d",
  ink: "#1b1207",
  veil: "#0a0806",
  shade: "#000000",
};

/**
 * A surface's finish: the gradients, shadows and shapes its stylesheet classes and named utilities draw, built
 * from its own palette. Each value is a CSS variable `--<group>-<name>` (`--primary-face`); `textShadow`, `shadow` and
 * `gradient` are also classes (`text-shadow-title`, `shadow-mark`, `bg-halo`).
 */
const finishOf = (c: Palette) => ({
  textShadow: {
    /** The faint glow on every line of text (index.css html, body). */
    ambient: "2px 2px 4px rgba(255, 255, 0, 0.1)",
    /** A page or hero title over a painting: a hard drop and a soft halo, in ink. */
    title: `0 2px 0 ${withAlpha(c.ink, 0.7)}, 0 0 24px ${withAlpha(c.ink, 0.6)}`,
    /** A title on a painting's quiet corner: the drop only. */
    "title-flat": `0 2px 0 ${withAlpha(c.ink, 0.7)}`,
  },
  shadow: {
    /** A docked sheet's round close mark, lifted off the panel's edge. */
    mark: `0 2px 8px ${withAlpha(c.shade, 0.6)}`,
    /** The live dot's ring. */
    live: `0 0 0 3px ${withAlpha(c.sage, 0.25)}`,
    /** A top tier's glow. */
    glow: `0 0 10px ${c.hot}`,
  },
  gradient: {
    /** The dev environment's hatched top edge. */
    stripes: `repeating-linear-gradient(135deg, ${c.muted} 0 4px, transparent 4px 8px)`,
    /** A page painting's grade: a vignette that keeps its heart lit, faded into the ground at its foot. */
    grade: `radial-gradient(120% 90% at 55% 38%, transparent 40%, ${withAlpha(c.ground, 0.85)} 100%), linear-gradient(0deg, ${c.ground} 0%, transparent 55%)`,
    /** The glow behind an opened reward. */
    halo: `radial-gradient(circle, ${withAlpha(c.gold, 0.3)}, transparent 65%)`,
    /** The rays behind a reward's stage. */
    rays: `repeating-conic-gradient(${withAlpha(c.gold, 0.18)} 0 6deg, transparent 6deg 18deg)`,
  },
  /** The primary button (`.frontier-primary`, kit Button's primary): gold metal on a dark drop. */
  primary: {
    face: `linear-gradient(180deg, #ffc24a, ${c.amber} 62%, #b76f00)`,
    rim: "#ffd98a",
    shadow: "0 5px 0 #6d4300, 0 10px 22px rgba(227, 144, 1, 0.35)",
    "shadow-disabled": "0 5px 0 #6d4300",
    radius: "18px",
    /** A primary whose verb still costs what the line under it says. */
    "warn-face": "linear-gradient(180deg, #ff7a66, #e0392d 62%, #a81f17)",
    "warn-rim": "#ffb3a6",
    "warn-shadow": "0 5px 0 #5e100b, 0 10px 22px rgba(224, 57, 45, 0.35)",
  },
  /** The overlay surface's warm ink, which every sheet and the HUD's panels share. */
  overlay: {
    "surface-from": "rgba(38, 29, 17, 0.98)",
    "surface-to": "rgba(16, 12, 8, 0.99)",
  },
  /** The kit's sheet (`.frontier-sheet`): a bottom sheet, or a panel docked from the desktop width up. */
  sheet: {
    shadow: `0 -14px 40px ${withAlpha(c.shade, 0.7)}`,
    "shadow-docked": `0 12px 30px ${withAlpha(c.shade, 0.6)}`,
    radius: "24px",
    "radius-docked": "12px",
    handle: "#5a4a30",
  },
  /** A card on the HUD's card token (`.frontier-card`): a reason plate, a guide card. */
  card: {
    face: "linear-gradient(180deg, #2a2013, #15100a)",
    radius: "18px",
    "pressed-glow": "0 0 18px rgba(246, 172, 29, 0.45)",
  },
  /** An amount on the chip token (`.frontier-chip`), and the tones a number takes on it. */
  chip: {
    ground: withAlpha(c.veil, 0.72),
    "gain-text": "#b9e58a",
    "loss-rim": "#e0533f",
    "loss-text": "#ff8a73",
    "lit-glow": "0 0 12px rgba(246, 172, 29, 0.35)",
  },
  /** The app's one panel surface (`.plate`) from the desktop width up: leather in a lit, gilded frame. */
  plate: {
    face: `linear-gradient(180deg, ${c.plate2}, ${c.plate})`,
    shadow: [
      "inset 0 1px 0 rgb(255 222 160 / 0.1)",
      `inset 0 0 0 1px ${withAlpha(c.shade, 0.6)}`,
      `inset 0 0 0 5px ${withAlpha(c.gold, 0.07)}`,
      `0 22px 50px ${withAlpha(c.shade, 0.55)}`,
    ].join(", "),
    /** The gold rule under a plate's title, fading at both ends. */
    "title-rule": `linear-gradient(90deg, transparent, ${withAlpha(c.gold, 0.7)} 30%, transparent)`,
  },
  /** A card whose ground is a painting (`.painted`) from the desktop width up: a gold keyline over the paint. */
  painted: {
    rim: withAlpha(c.gold, 0.45),
    shadow: `0 18px 44px ${withAlpha(c.shade, 0.6)}`,
    keyline: `inset 0 0 0 1px ${withAlpha(c.shade, 0.55)}, inset 0 0 0 4px ${withAlpha(c.gold, 0.18)}`,
  },
  /** The sign-in panel's ground (`.leather`). */
  leather: {
    face: `linear-gradient(90deg, ${c.plate}, ${c.ground})`,
    shadow: `inset -1px 0 0 rgb(255 222 160 / 0.07), 6px 0 24px ${withAlpha(c.shade, 0.5)}`,
  },
});

type Finish = ReturnType<typeof finishOf>;

/** The HUD's finish, from its palette. */
export const HUD_FINISH: Finish = finishOf(HUD_COLORS);

/**
 * The shell's finish, from its palette. To restyle a part of the shell alone, replace its group here
 * (`{ ...finishOf(SHELL_COLORS), primary: { ... } }`); a change inside `finishOf` moves both surfaces.
 */
export const SHELL_FINISH: Finish = finishOf(SHELL_COLORS);

/**
 * A surface's CSS variables: each colour as `--<name>` (`#rrggbb`, for stylesheets) and `--kit-<name>` (channels, for
 * the `kit-*` classes), and each finish value as `--<group>-<name>`.
 */
export const surfaceVariables = (colors: Palette, finish: Finish): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(colors).flatMap(([name, hex]) => [
      [`--${name}`, hex],
      [`--kit-${name}`, channels(hex)],
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(finish).flatMap(([group, values]) =>
      Object.entries(values).map(([name, value]) => [`--${kebab(group)}-${name}`, value]),
    ),
  ),
});

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * The brand's faces, one role each (Realms Brand Deck v3, page 6): Realms Titling for a game's title, IM Fell English SC
 * for headings, Exo 2 for everything read, Cinzel for short labels and controls. Each comes from the brand kit
 * (`02-Fonts`) and is served from the app (public/fonts/SOURCE.md); the HUD reads in the reading face.
 */
export const FONTS = {
  /** A game's own title, at 32px and above: Frontier, Blitz 16:00. Its capitals only; others fall back to headings. */
  game: '"Realms Titling", "IM Fell English SC", serif',
  /** Headings: a page's or a panel's title, the one display line of a page. */
  display: '"IM Fell English SC", serif',
  /** Controls and short labels: buttons, tabs, the bar's places, the footer's links. */
  ui: '"Cinzel", serif',
  /** Everything read: text, rows, chips, figures. */
  body: '"Exo 2", system-ui, sans-serif',
} as const;

/**
 * Each face as the brand kit ships it, with its licence beside it (public/fonts/SOURCE.md). A face's files claim every
 * weight between them, so a bold line keeps its true letters and is never synthesised.
 */
export const FONT_FACES = [
  {
    fontFamily: '"Realms Titling"',
    src: 'url("/fonts/realms-titling-bold.woff2") format("woff2")',
    fontWeight: "100 900",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"IM Fell English SC"',
    src: 'url("/fonts/im-fell-english-sc-regular.ttf") format("truetype")',
    fontWeight: "100 900",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"Exo 2"',
    src: 'url("/fonts/exo-2.woff2") format("woff2")',
    fontWeight: "100 900",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"Cinzel"',
    src: 'url("/fonts/cinzel-regular.woff2") format("woff2")',
    fontWeight: "100 500",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"Cinzel"',
    src: 'url("/fonts/cinzel-semibold.woff2") format("woff2")',
    fontWeight: "600 900",
    fontDisplay: "swap",
  },
] as const;

/**
 * The shell's type scale; every step is at least 14px, the app's smallest text. The three reading steps carry Tailwind's
 * line-heights (`text-caption` is `text-sm`, `text-body` is `text-base`, `text-lead` is `text-lg`); the display steps
 * are size-only, because each title sets its own leading.
 */
export const TYPE = {
  /** Small labels, chips, muted notes. */
  caption: ["14px", "20px"],
  /** Text and rows. */
  body: ["16px", "24px"],
  /** Panel titles, emphasised words. */
  lead: ["18px", "28px"],
  /** The phone's page title, body-face headlines, a profile's season figure. */
  heading: "26px",
  /** Display titles, a plate's title, figures on a phone. */
  title: "32px",
  /** Display titles on the wide screen, a mid figure. */
  "title-lg": "40px",
  /** The post, sign-in and results headlines. */
  hero: "44px",
  /** The largest headline: Play's and a season's ending on desktop. */
  display: "56px",
  /** The countdown, a place, the seats, a reward's multiple. */
  figure: "64px",
} as const;

/** Corner radii by what they round; pills and avatars keep Tailwind's `rounded-full`. */
export const RADII = {
  /** A thumbnail, a small outlined button. */
  thumb: "8px",
  /** Controls: fields, tabs, switches, notices, small cards. */
  control: "12px",
  /** A well: a recessed or dashed box inside a plate. */
  well: "14px",
  /** Plates, painted cards, big buttons. */
  plate: "16px",
} as const;

/**
 * The spacing scale every padding, margin, gap, inset and size step reads (`p-4`, `gap-2.5`, `size-12`): Tailwind's own
 * 4px scale, restated so it is adjusted here. A key is the step in quarters of a rem (`4` is 1rem).
 */
export const SPACING = {
  px: "1px",
  0: "0px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  44: "11rem",
  48: "12rem",
  52: "13rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
} as const;

/** Column and measure widths, as `max-w-*` and `w-*`. */
export const WIDTHS = {
  /** A reading column: a post, the legal pages. */
  prose: "760px",
  /** The news feed. */
  feed: "48rem",
  /** A form or a list column: sign-in, the profile, the doorway's plate. */
  column: "34rem",
  /** The column on a wide screen. */
  "column-wide": "38rem",
  /** The sign-in painting's line. */
  tagline: "36rem",
  /** A small dialog plate. */
  dialog: "30rem",
  /** The desktop bar's notice. */
  tabs: "28rem",
  /** A page's side rail. */
  rail: "26rem",
  /** The doorway's realm. */
  doorway: "640px",
  /** A post's headline. */
  headline: "60rem",
  /** A two-column page's whole width. */
  page: "74rem",
  /** A post's body text. */
  measure: "68ch",
  /** The Play page's hero line. */
  "hero-measure": "16ch",
} as const;

/** A page's side gutters, by screen: phone, desktop, wide. */
export const GUTTERS = {
  gutter: "1rem",
  "gutter-desk": "2rem",
  "gutter-wide": "3rem",
} as const;

/** The desktop layout's first width: Tailwind's `lg`, and the JS layout's (shell/frame/layout.ts). */
export const DESKTOP_MIN_PX = 1024;

export const SCREENS = {
  /** Tailwind's own value, restated so `lg:` and the JS layout read one number. */
  lg: `${DESKTOP_MIN_PX}px`,
  /** Past the desktop: wider gutters and columns from here. */
  wide: "1800px",
} as const;

/**
 * The HUD's style sheet: the scope of this file every in-game element reads (/lab/kit shows each one), written as
 * `--hud-*` CSS variables (tailwind.config.js). One sheet for Blitz, Eternum and Frontier, on desktop and phone: a mode
 * changes only its surface (HUD_MODES), a phone only its sizes (HUD_PHONE).
 *
 * The type scale (owner, 17 October 2026: "font sizes are all over the place"): a handful of sizes and weights, each
 * named by its role. A HUD text takes a role (`text-hud-body`), never a size.
 */
export const HUD_TYPE = {
  /** A window's title, a figure that is the point of its panel. */
  display: { size: "20px", line: "26px", weight: "700" },
  /** A panel's or a tab's title, a place's own name. */
  title: { size: "16px", line: "22px", weight: "600" },
  /** Everything read: text, rows, a tooltip's line, a field's value, a player's name. */
  body: { size: "14px", line: "20px", weight: "500" },
  /** A number or a word that must stand out in its line: a count, a total, a button's verb. */
  strong: { size: "14px", line: "20px", weight: "700" },
  /** Labels, chips, cues, ids and times: what names or qualifies the text beside it. */
  label: { size: "12px", line: "16px", weight: "600" },
  /** A ring's rim badge, fitted to its ring: nothing else. */
  badge: { size: "11px", line: "14px", weight: "700" },
} as const;

/** The HUD's colours, sizes, lines, shadows and motion, by role; the HUD's gold and ink are the kit's. */
export const HUD_SHEET = {
  /** The primary button's face and what is earned (a place, LORDS), in every age, as channels. */
  gold: channels(HUD_COLORS.gold),
  /** What is read on a HUD surface. */
  ink: channels(HUD_COLORS.cream),
  /** Text on a gold face. */
  dark: channels(HUD_COLORS.ink),
  /** An input's or a map's recess. */
  well: "rgb(0 0 0 / 0.4)",
  /** The black the screen drops into between two Frontier days, and the dark a later arrival's summary waits in. */
  night: HUD_COLORS.shade,
  /**
   * Whose a thing is, in three sides (owner, 2026-10-21: "red for everything thats not me, blue for allies ... and green
   * for me"): yours green, an ally's (a tribe member's) blue, anyone else's red, nobody's too. A watching viewer has no
   * side: each player takes their seat's colour (SEAT_COLOURS) and nobody's things `neutral`.
   */
  own: "#66ddab",
  ally: "#6aa8ff",
  enemy: "#ff7b6b",
  neutral: "#b9b1a1",
  /** The ring round the selected thing on the map, whoever's it is. */
  selected: HUD_COLORS.gold2,
  /** How a thing stands: good (ready, gained), bad (refused, lost), warn (costly, waiting). */
  good: "#66ddab",
  bad: "#ff7b6b",
  warn: "#f0b35a",
  /** Each kind of relic, what it works on: its chip's words, line and ground take this colour. */
  "relic-stamina": "#4ade80",
  "relic-damage": "#f87171",
  "relic-damage-reduction": "#60a5fa",
  "relic-exploration": "#c084fc",
  "relic-production": "#facc15",
  /** Troop tiers, as channels: T1 blue, T2 green, T3 purple. */
  t1: "96 165 250",
  t2: "52 211 153",
  t3: "147 51 234",
  /** A chest's rarity, common to legendary, by order: each frame warmer than the last. */
  "rarity-1": HUD_COLORS.line2,
  "rarity-2": HUD_COLORS.muted,
  "rarity-3": HUD_COLORS.gold,
  "rarity-4": HUD_COLORS.gold2,
  "rarity-5": "#f6ac1d",
  /** A control's height; a touch target's is HUD_PHONE's. */
  control: "36px",
  /** Inline icons sit on the text baseline in Feed lines and links. */
  "icon-baseline": "-0.2em",
  /** Corners: a chip's, a control's, a panel's, a round thing's. */
  "radius-chip": "4px",
  "radius-control": "8px",
  "radius-panel": "12px",
  "radius-round": "9999px",
  /** One speed for every hover and press. */
  fast: "120ms",
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

/** The HUD's values built from others, declared again on every mode's root so a changed gold reaches each of them. */
export const HUD_DERIVED = {
  line: "rgb(var(--hud-accent) / 0.25)",
  "line-strong": "rgb(var(--hud-accent) / 0.5)",
  divider: "rgb(var(--hud-accent) / 0.15)",
  muted: "rgb(var(--hud-accent) / 0.75)",
  cue: "rgb(var(--hud-accent) / 0.6)",
  hover: "rgb(var(--hud-accent) / 0.1)",
  chosen: "rgb(var(--hud-accent) / 0.18)",
  "shadow-panel": "0 8px 24px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(var(--hud-accent) / 0.18)",
  "shadow-control": "0 1px 2px rgb(0 0 0 / 0.4)",
  focus: "0 0 0 2px rgb(var(--hud-accent) / 0.65)",
} as const;

/**
 * The sheet's colours as Tailwind colour names, for the words and rules inside an element (`text-hud-muted`,
 * `border-hud-line`). Each is a role, so none takes an opacity modifier; none shares a name with a HUD_TYPE role.
 */
export const HUD_COLOR_CLASSES: Record<string, string> = Object.fromEntries([
  ...["accent", "gold", "ink", "dark"].map((name) => [name, `rgb(var(--hud-${name}))`]),
  ...[
    "well",
    "night",
    "own",
    "ally",
    "enemy",
    "neutral",
    "good",
    "bad",
    "warn",
    "line",
    "line-strong",
    "divider",
    "muted",
    "cue",
    "hover",
    "chosen",
    ...[1, 2, 3, 4, 5, 6].map((order) => `group-${order}`),
  ].map((name) => [name, `var(--hud-${name})`]),
  // The age's panel ground, opaque: a card or a well that must hide the map under it.
  ["surface", "var(--hud-surface-to)"],
]);

/** `#rrggbb` of `over` laid on `ground` at `share` (0 to 1): a dark surface tinted by a kit colour. */
const tint = (ground: string, over: string, share: number) =>
  `#${[1, 3, 5]
    .map((at) => {
      const [base, top] = [ground, over].map((hex) => parseInt(hex.slice(at, at + 2), 16));
      return Math.round(base * (1 - share) + top * share)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;

/** The brand kit's game identities (`games` in src/brand/palette.json), lower-cased. */
const GAME = (game: keyof typeof KIT.games, role: "title" | "ground") => KIT.games[game][role].toLowerCase();

/**
 * Each game is an age of the lore, and wears its age's colours (owner, 17 October 2026: "a different color for each
 * game, like in the lore each game is one age"): its accent (every line, title, label, tab and focus ring, as channels)
 * and its surface. Blitz and Frontier take the brand kit v3's (owner, 29 October 2026, of /picks/brand-v3/: "I agree
 * with the brand calls"): Blitz its Spark title on a dark Ember, Frontier its title violet on its own ground. Eternum's
 * kit ground is parchment, so on the dark HUD it keeps its gold. The elements never change; the primary button stays
 * gold in every age.
 */
export const HUD_MODES = {
  /** Blitz: Spark on Ember, laid dark on Hearth. */
  blitz: {
    accent: channels(GAME("blitz", "title")),
    "surface-from": tint(BRAND.hearth, GAME("blitz", "ground"), 0.3),
    "surface-to": tint(BRAND.hearth, GAME("blitz", "ground"), 0.15),
  },
  /** Frontier: the title's violet on Frontier's ground. */
  frontier: {
    accent: channels(GAME("frontier", "title")),
    "surface-from": tint(GAME("frontier", "ground"), GAME("frontier", "title"), 0.06),
    "surface-to": GAME("frontier", "ground"),
  },
  /** Eternum (`eternum-restoration`): the restored tower's gold over warm stone. */
  eternum: { accent: "230 194 122", "surface-from": "#27211a", "surface-to": "#16120d" },
};

export type HudMode = keyof typeof HUD_MODES;

/** What a phone changes: touch targets, and the reading roles a step up; every element keeps its shape. */
export const HUD_PHONE = {
  control: "44px",
  "text-title": "17px",
  "text-body": "15px",
  "text-strong": "15px",
  "text-label": "13px",
} as const;

/**
 * The HUD's frame on a desktop, as Tailwind's `hud-*` spacing (`w-hud-column`, `top-hud-header`, `max-h-hud-list`): its
 * two columns' width, where they start under the top bar and where they end above the screen's foot (the band under
 * them is the build tag's row, so nothing in a column covers it), the foot's inset that keeps the order bubbles clear
 * of both columns, how tall a list grows before it scrolls, the minimap's least height, the compact HUD's section height
 * and two rows of resource rings with their badges; and the chat dock opened: its width, its tall height, and the cap
 * that keeps it off half a laptop screen.
 */
export const HUD_LAYOUT = {
  column: "320px",
  header: "60px",
  base: "16px",
  foot: "344px",
  list: "40vh",
  minimap: "160px",
  section: "clamp(180px, 30vh, 320px)",
  "ring-rows": "164px",
  /** The top bar's Settings panel, opened under its button. */
  settings: "420px",
  /** The day's summary over the map at a Frontier day's end, on a desktop (a phone's is a sheet). */
  summary: "400px",
  /** A phone's top bar, both its rows (Blitz's and Frontier's end by 94px): the game's news stands under it. */
  "phone-header": "100px",
  /** The phone layouts stand above the keyboard inset shared by the root viewport hook. */
  keyboard: "var(--keyboard, 0px)",
  /** The phone's minimap tab. */
  "phone-minimap": "clamp(180px, 35dvh, 320px)",
  /** The most of a phone's screen a page or a sheet takes, sized to what it holds (owner, 26 October 2026: layout A). */
  "phone-panel": "45dvh",
  "chat-width": "800px",
  "chat-height": "600px",
  /**
   * The open chat's pane, and never taller than what the on-screen keyboard leaves (--keyboard, useKeyboardInset) less
   * the phone's top bar (phone-header, 100px) and the strip under the pane (60px): typing, its tabs stay on screen.
   */
  "chat-pane": "min(60vh, 520px, calc(100dvh - var(--keyboard, 0px) - 160px))",
  /** The open chat's least height in the right column, its strip included: the composer and a few lines of history. */
  "chat-least": "300px",
  /** The picked tile's details' least height in the right column (less when they hold less): a header and a body. */
  "details-least": "120px",
  "chat-cap": "45vw",
  /**
   * Frontier's places on the desktop HUD (FrontierDesktop): a sheet floating with no rail to stand in (the labs'), its
   * width and top, and the stage between the columns.
   */
  "frontier-page": "440px",
  /**
   * Frontier's desktop rail, the one home for everything (the owner, 22 October): one width for the feed at home and
   * for any panel (a page, a sheet) that stands in it ("feed should have the same width as the other panels").
   */
  "frontier-rail": "480px",
  "frontier-page-top": "76px",
  /** The Frontier HUD's cards: an army token, a site card, and the Build sheet's building card (option B's band). */
  "frontier-token": "72px",
  "frontier-card": "92px",
  "frontier-build-card": "136px",
} as const;

/**
 * The HUD's stacking above the map: its columns, the order bubbles between them, the rail over both, what flies over
 * them; then what opens over the whole HUD: a loading line, a popover or window, a menu over it, the app's one tooltip.
 */
export const HUD_LAYERS = {
  column: "20",
  foot: "26",
  rail: "30",
  /** A Frontier sheet over the stage; its backdrop one under it. */
  sheet: "40",
  motion: "60",
  loading: "110",
  popover: "130",
  menu: "140",
  tip: "250",
} as const;

/**
 * The HUD sheet's CSS variables: `--hud-<name>`, and each type role as `--hud-text-<role>`, `--hud-leading-<role>`,
 * `--hud-weight-<role>`. A role's leading is never `--hud-line-*`: that is an edge's colour (line, line-strong).
 */
export const hudVariables = (): Record<string, string> =>
  variablesOf([
    ...Object.entries(HUD_SHEET).map(([name, value]): [string, string] => [`--hud-${name}`, value]),
    ...Object.entries(HUD_TYPE).flatMap(([role, { size, line, weight }]): [string, string][] => [
      [`--hud-text-${role}`, size],
      [`--hud-leading-${role}`, line],
      [`--hud-weight-${role}`, weight],
    ]),
    ["--hud-font", FONTS.body],
  ]);

/** CSS variables from their names and values, each name written once: two meanings never share a variable. */
const variablesOf = (entries: [string, string][]): Record<string, string> => {
  const variables: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (name in variables) throw new Error(`The CSS variable ${name} is written twice`);
    variables[name] = value;
  }
  return variables;
};

/** Each mode's variables, and the derived values again, so a mode root (and the lab's editor on it) restyles them. */
export const hudModeVariables = (mode: HudMode | "app"): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(mode === "app" ? HUD_APP_MODE : HUD_MODES[mode]).map(([name, value]) => [`--hud-${name}`, value]),
  ),
  ...Object.fromEntries(Object.entries(HUD_DERIVED).map(([name, value]) => [`--hud-${name}`, value])),
});

/**
 * A watching viewer's colour for each player's seat (owner, 2026-10-21: "when you're spectating maybe a diff color for
 * every player"; "yeah the labels are great now"). 24 colours picked in OKLab, each the farthest from those before it and
 * from the map's desert and grass, so the first N are the best N for an N-player game; each keeps a plate's count
 * readable on its tint (4.5:1) and its ring off the dark disk (3:1). A seat past the 24th takes the colours again, from
 * the first: its player's initial and name still tell it apart.
 */
export const SEAT_COLOURS = [
  "#fd7562",
  "#4aea7d",
  "#3fa0fa",
  "#b954cf",
  "#30a100",
  "#eaaef8",
  "#f0c12a",
  "#54dcf2",
  "#5f6fa1",
  "#a79d62",
  "#b88ab3",
  "#de4181",
  "#1eb39e",
  "#f5b6a0",
  "#7370fa",
  "#118659",
  "#acd5a3",
  "#bf6e3e",
  "#f57bec",
  "#a5bf36",
  "#94b2e4",
  "#955e78",
  "#767700",
  "#ab81ef",
] as const;

/** How a playing viewer stands to a thing's owner: theirs, an ally's, another player's, or nobody's (a beast's). */
export type Side = "own" | "ally" | "enemy" | "neutral";

/**
 * The colour each side is drawn in, the one rule the map's labels and the minimap both read (HUD_SHEET own, ally,
 * enemy): nobody's is drawn as an enemy's, as everything not the viewer's or an ally's is red.
 */
export const SIDE_COLOURS: Record<Side, string> = {
  own: "var(--hud-own)",
  ally: "var(--hud-ally)",
  enemy: "var(--hud-enemy)",
  neutral: "var(--hud-enemy)",
};

/** A side told by seat: the seat's colour and the ink its initial is written in; nobody's (no seat) in neutral grey. */
export type SeatSide = { seat: number; colour: string; ink: "dark" | "light" } | { seat: null; colour: string };

/** The seat's side: its colour (SEAT_COLOURS, again from the first past the 24th), or grey for nobody's. */
export const seatSide = (seat: number | null): SeatSide => {
  if (seat === null || seat < 0) return { seat: null, colour: HUD_SHEET.neutral };
  const colour = SEAT_COLOURS[seat % SEAT_COLOURS.length];
  // The initial is written in whichever of the HUD's dark ink and its cream reads better on the colour (WCAG contrast).
  const own = luminance(colour);
  const onDark = (own + 0.05) / (luminance(HUD_COLORS.ink) + 0.05);
  const onCream = (luminance(HUD_COLORS.cream) + 0.05) / (own + 0.05);
  return { seat, colour, ink: onDark >= onCream ? "dark" : "light" };
};

/** A #rrggbb colour's relative luminance (WCAG 2). */
const luminance = (colour: string): number => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(colour.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Map scope: appearance only. Live managers keep their shipped presentation until approval. */
export const MAP_SHEET = {
  ownership: {
    you: HUD_SHEET.own,
    ally: HUD_SHEET.ally,
    enemy: HUD_SHEET.enemy,
    neutral: HUD_SHEET.neutral,
    unowned: HUD_SHEET.neutral,
  },
  danger: HUD_SHEET.bad,
  ink: HUD_COLORS.cream,
  casing: HUD_COLORS.ink,
  fill: { selected: 0.12, endpoint: 0.18, range: 0.04 },
  ring: { outerRadius: 0.98, innerRadius: 0.96, casingWidth: 0.018, opacity: 0.9 },
  line: { width: 0.045, casingWidth: 0.09, opacity: 0.9, previewOpacity: 0.45 },
  marker: { size: 0.85 },
  fogEdge: { opacity: 0.16, width: 0.025 },
} as const;

export function mapAgeAccent(age: HudMode): string {
  return (
    "#" +
    HUD_MODES[age].accent
      .split(" ")
      .map((channel) => Number(channel).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * The app's style sheet: the shell's scope of this file, every page outside a game reads (/lab/kit/app shows each
 * element), written as `--app-*` CSS variables under `data-surface="shell"` (tailwind.config.js). The same idea as the
 * HUD's sheet: a handful of type roles, colour roles, and elements built only from them; its own colour scope, so an
 * app value never moves a HUD pixel. Where the app shows a game, that game's age (HUD_MODES) colours it: one source.
 *
 * The type scale, one face per role as the brand deck sets them (page 6): a game's title in its title face, headings in
 * the display face, controls in the labels face, everything read in the body face, nothing under 14px (the app's
 * floor). An app text takes a role (`text-app-body`), never a size.
 */
export const APP_TYPE = {
  /** The one hero line of a page on the desktop: Play's call, a season's ending. */
  display: { size: "56px", line: "60px", weight: "400", face: "display" },
  /** A page's or a card's title: Season 3, Your ticket. */
  title: { size: "32px", line: "38px", weight: "400", face: "display" },
  /** A game's name on its card or column: Frontier, Blitz 16:00. */
  game: { size: "32px", line: "38px", weight: "700", face: "game" },
  /** A panel's or a section's name: Frontier standings, Entry, Recent games. */
  heading: { size: "20px", line: "28px", weight: "400", face: "display" },
  /** Everything read: text, rows, a field's value, a player's name. */
  body: { size: "16px", line: "24px", weight: "500", face: "body" },
  /** What must stand out in its line: a count, a total, the player's own row. */
  strong: { size: "16px", line: "24px", weight: "700", face: "body" },
  /** A button's verb, a tab, a place in the bar. */
  control: { size: "16px", line: "24px", weight: "600", face: "ui" },
  /** Labels, chips, times and meta lines: what names or qualifies the text beside it. */
  label: { size: "14px", line: "20px", weight: "600", face: "body" },
  /** A figure that is the point of its panel: the countdown, a rank, the seats taken, the points. */
  figure: { size: "48px", line: "52px", weight: "700", face: "body" },
} as const;

/** The app's colours, sizes and motion, by role; its gold, ground and ink are the shell palette's. */
export const APP_SHEET = {
  /** Every page's ground, under its painting. */
  ground: SHELL_COLORS.ground,
  /** A panel's or a card's face, opaque; a raised one (a chosen row, a secondary button) is surface-2. */
  surface: SHELL_COLORS.plate,
  "surface-2": SHELL_COLORS.plate2,
  /** What is read, and what is secondary. */
  ink: SHELL_COLORS.cream,
  muted: SHELL_COLORS.muted,
  /** The brand accent: the current place in the navigation, focus rings, the player's own row. As channels. */
  accent: channels(SHELL_COLORS.peach),
  /** The primary button's face and what is earned (a place, LORDS), as channels; text on it is dark. */
  gold: channels(SHELL_COLORS.gold),
  dark: SHELL_COLORS.ink,
  /** Edges: a panel's, a control's, a chosen one's. Never text. */
  line: SHELL_COLORS.line,
  "line-strong": SHELL_COLORS.line2,
  /** A field's or a list's recess. */
  well: "rgb(0 0 0 / 0.35)",
  /**
   * Eternum's ground where its lockup stands (the kit's Play card grades Eternum to parchment, its title being inked
   * for parchment), and what reads on it: umber ink, and the Realms stamp's brown for what is secondary.
   */
  parchment: BRAND.parchment,
  "parchment-ink": BRAND["umber-ink"],
  "parchment-muted": KIT.games.eternum.stamp.toLowerCase(),
  /** How a thing stands: good (live, gained), bad (refused, lost), warn (closing soon, waiting). */
  good: SHELL_COLORS.sage,
  bad: SHELL_COLORS.red,
  warn: SHELL_COLORS.amber,
  /** A control's height, and a large one's (a page's one verb). */
  control: "44px",
  "control-lg": "56px",
  /** The bar across the top of every page, and the widest a page's content runs on a desktop. */
  bar: "72px",
  /**
   * The lettered mark in the bar, and in the phone's top row (owner, 29 October 2026: "the one with the realms in the
   * circle as the logo in the top nav bar"): sized so its word reads, its R about 15 px and 13 px tall.
   */
  mark: "56px",
  "mark-phone": "48px",
  page: "1680px",
  /** Corners: a chip's, a control's, a panel's, a round thing's. */
  "radius-chip": "6px",
  "radius-control": "12px",
  "radius-panel": "16px",
  "radius-round": "9999px",
  /** Elevation: a panel over a painting, a dialog over the page. */
  "shadow-panel": "0 12px 32px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.04)",
  "shadow-dialog": "0 24px 64px rgb(0 0 0 / 0.6)",
  /** One speed for every hover and press. */
  fast: "120ms",
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

/**
 * The HUD's elements drawn in the app (its chat, in a pane over a page or a page of its own): the app sheet's accent,
 * surfaces and ink in the HUD's roles, so the one chat reads as the app around it ([data-hud-mode="app"]).
 */
export const HUD_APP_MODE = {
  accent: APP_SHEET.accent,
  "surface-from": APP_SHEET["surface-2"],
  "surface-to": APP_SHEET.surface,
  ink: channels(SHELL_COLORS.cream),
} as const;

/** The app's values built from others: hover and chosen tints and the focus ring follow the accent. */
const APP_DERIVED = {
  hover: "rgb(var(--app-accent) / 0.08)",
  chosen: "rgb(var(--app-accent) / 0.14)",
  focus: "0 0 0 2px rgb(var(--app-accent) / 0.7)",
} as const;

/** The sheet's colours as Tailwind colour names (`text-app-muted`, `bg-app-surface`); each a role, none with opacity. */
export const APP_COLOR_CLASSES: Record<string, string> = Object.fromEntries([
  ...["accent", "gold"].map((name) => [name, `rgb(var(--app-${name}))`]),
  ...[
    "ground",
    "surface",
    "surface-2",
    "ink",
    "muted",
    "dark",
    "line",
    "line-strong",
    "well",
    "good",
    "bad",
    "warn",
  ].map((name) => [name, `var(--app-${name})`]),
  ...["hover", "chosen"].map((name) => [name, `var(--app-${name})`]),
  // The age of the game a card or a page shows (data-age), as its accent.
  ["age", "rgb(var(--app-age))"],
]);

/**
 * The app sheet's CSS variables, under `data-surface="shell"`: `--app-<name>`, each type role as `--app-text-<role>`,
 * `--app-leading-<role>`, `--app-weight-<role>`, `--app-face-<role>`; and the age a game shows, Blitz's by default. A
 * role's leading is never `--app-line-*`: that is an edge's colour (line, line-strong).
 */
export const appVariables = (): Record<string, string> =>
  variablesOf([
    ...Object.entries(APP_SHEET).map(([name, value]): [string, string] => [`--app-${name}`, value]),
    ...Object.entries(APP_DERIVED).map(([name, value]): [string, string] => [`--app-${name}`, value]),
    ...Object.entries(APP_TYPE).flatMap(([role, { size, line, weight, face }]): [string, string][] => [
      [`--app-text-${role}`, size],
      [`--app-leading-${role}`, line],
      [`--app-weight-${role}`, weight],
      [`--app-face-${role}`, FONTS[face]],
    ]),
    ...Object.entries(appAgeVariables("blitz")),
  ]);

/** A game's age, wherever the app shows one (`data-age` on its card or page): the HUD's own age colours, one source. */
export const appAgeVariables = (age: HudMode): Record<string, string> => ({
  "--app-age": HUD_MODES[age].accent,
  "--app-age-from": HUD_MODES[age]["surface-from"],
  "--app-age-to": HUD_MODES[age]["surface-to"],
});
