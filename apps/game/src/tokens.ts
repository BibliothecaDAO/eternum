/**
 * The one token file: every visual value the shell (src/shell, the doorway, src/pwa and the kit) renders with, and the
 * HUD's palette and finish beside it. Tailwind reads it (tailwind.config.js) and writes each value as a CSS variable,
 * so classes, index.css and code that cannot take a class read the same values. Where the kit and the code named a
 * value for the same role, the kit's won (brand.html, ruled 7 October 2026).
 *
 * How to restyle the shell
 *
 * - Change a value here, never in a component or in index.css. `pnpm shell:check` refuses one-off colours, sizes,
 *   radii, shadows and gradients in the shell's code and literal values in the stylesheet classes it renders.
 * - The shell and the HUD are two surfaces. The HUD reads `HUD_COLORS` and `HUD_FINISH` (on :root); the shell reads
 *   `SHELL_COLORS` and `SHELL_FINISH` (under `data-surface="shell"`, which PageFrame, the doorway and the install sheet
 *   set). The `kit-*` classes and index.css's shared classes (the primary button, sheet, chip, card, plate, painted
 *   card, leather and grain) resolve to whichever surface they render in, so a shell value never moves a HUD pixel and
 *   a HUD value never moves a shell pixel.
 * - Faces (`FONTS`), the type scale, radii, widths, gutters, the spacing scale and screens are one set for the whole
 *   app: the HUD's kit components (a Button, a Panel) follow them too.
 * - /lab/kit/tokens draws every value from this file; /lab/app and /lab/kit show it in place.
 */

/** `r g b` channels of a `#rrggbb` colour: the form Tailwind's `rgb(var(--kit-x) / <alpha-value>)` classes read. */
const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(" ");

/** `rgb(r g b / alpha)` of a `#rrggbb` colour, so a shadow or a gradient follows its colour token. */
const withAlpha = (hex: string, alpha: number) => `rgb(${channels(hex)} / ${alpha})`;

/** The HUD's palette: the in-game interface, and :root's (`--ground`, `bg-kit-ground` outside the shell). */
export const HUD_COLORS = {
  /** Every page's background, the install splash, the status bar. */
  ground: "#130f0c",
  /** Cards and plates, always opaque. */
  plate: "#201a16",
  /** A secondary button's face, a pressed row. */
  plate2: "#2a221c",
  /** Card edges and separators; never text. */
  line: "#46351c",
  /** Chip and outline-button edges; never text. */
  line2: "#6b5230",
  /** Text, and the logo on dark. */
  cream: "#f4ebdc",
  /** Secondary text. */
  muted: "#a2926f",
  /** Earned and press-me: the primary button's face, a place or LORDS won. */
  gold: "#dfaa54",
  /** The lit rim, the ending line. */
  gold2: "#f3d08a",
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
  ground: "#130f0c",
  plate: "#201a16",
  plate2: "#2a221c",
  line: "#46351c",
  line2: "#6b5230",
  cream: "#f4ebdc",
  muted: "#a2926f",
  gold: "#dfaa54",
  gold2: "#f3d08a",
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
 * A surface's finish: the gradients, shadows, ornament and shapes its stylesheet classes and named utilities draw, built
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
    "price-ground": "rgba(27, 18, 7, 0.9)",
    "price-rim": "#b76f00",
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
  /** The fine grain over a painted card and a backdrop (`.grain`). */
  grain: { opacity: "0.32" },
  /** The ornament's art (public/images/ornament/SOURCE.md). */
  ornament: {
    "corner-top-left": 'url("/images/ornament/corner-top-left.svg")',
    "corner-top-right": 'url("/images/ornament/corner-top-right.svg")',
    "corner-bottom-right": 'url("/images/ornament/corner-bottom-right.svg")',
    "corner-bottom-left": 'url("/images/ornament/corner-bottom-left.svg")',
    leather: 'url("/images/ornament/leather.svg")',
    grain: 'url("/images/ornament/grain.svg")',
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
 * The app's two faces (decisions-1, 14 October 2026): Bokor for page and card titles only, and Atkinson Hyperlegible
 * Next for everything read (labels, buttons, text, numbers), in sentence case, upright and untracked. IM FELL English SC
 * survives only inside the lockup (an SVG), so the app ships no IM FELL file. Cinzel stays banned.
 */
const BODY_FACE = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

export const FONTS = {
  /** Titles: page and card titles, the one display line of a page. */
  display: '"Bokor", serif',
  /**
   * Labels: buttons, pills, section labels, panel titles, tabs and switches, a row's name, entry rows, the countdown's
   * word. The body face today; its own role so a labels face can be adopted (the realms.world reskin) by changing this
   * one value.
   */
  ui: BODY_FACE,
  /** Everything read. */
  body: BODY_FACE,
} as const;

/**
 * Served from the app (public/fonts), each file as the brand kit or Google Fonts ships it with its licence beside it
 * (public/fonts/SOURCE.md). A face with one weight claims every weight, so a bold title keeps its true letters and is
 * never synthesised.
 */
export const FONT_FACES = [
  {
    fontFamily: '"Atkinson Hyperlegible Next"',
    src: 'url("/fonts/atkinson-hyperlegible-next.woff2") format("woff2")',
    fontWeight: "200 800",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"Bokor"',
    src: 'url("/fonts/bokor-regular.ttf") format("truetype")',
    fontWeight: "100 900",
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
  /** A keyboard key hint. */
  key: "5px",
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
