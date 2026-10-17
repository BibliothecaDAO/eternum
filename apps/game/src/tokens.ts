/**
 * The one token file: the kit's colours, the HUD's gold and lines, and the app's two faces. Tailwind reads it (the
 * colours as `kit-*` classes, the faces as `font-body` and `font-display`) and writes each value as a CSS
 * variable on :root (`--ground`, `--font-body`), so the HUD's stylesheet and the shell read the same values. Where the
 * kit and the code named a value for the same role, the kit's won (brand.html, ruled 7 October 2026).
 */
export const COLORS = {
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
} as const;

/**
 * The app's two faces (decisions-1, 14 October 2026): Bokor for page and card titles only, and Atkinson Hyperlegible
 * Next for everything read (labels, buttons, text, numbers), in sentence case, upright and untracked. The Blitz and
 * Eternum HUD reads in its own faces (CLASSIC_HUD_FONTS).
 */
const BODY_FACE = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

export const FONTS = {
  /** Titles: page and card titles, the one display line of a page. */
  display: '"Bokor", serif',
  /**
   * Labels: plate titles, entry rows, the countdown's word. The body face today; its own role so a labels face can be
   * adopted (the realms.world reskin) by changing this one value.
   */
  ui: BODY_FACE,
  /** Everything read. */
  body: BODY_FACE,
} as const;

/**
 * The Blitz and Eternum HUD's face (its War room skin, 16 October 2026), as a CSS variable under html.classic-hud only:
 * Exo 2 for everything read there, panel titles included (--font-ui, also `font-ui`).
 */
export const CLASSIC_HUD_FONTS = {
  ui: '"Exo 2", "Atkinson Hyperlegible Next", system-ui, sans-serif',
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
  {
    fontFamily: '"Exo 2"',
    src: 'url("/fonts/exo-2.woff2") format("woff2")',
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
  /** The phone's page title, body-face headlines. */
  heading: "26px",
  /** Display titles and figures on a phone. */
  title: "32px",
  /** Display titles on desktop, a mid figure. */
  "title-lg": "40px",
  /** The post, sign-in and results headlines. */
  hero: "44px",
  /** The largest headline. */
  display: "56px",
  /** The countdown, a place, the seats. */
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

/** `rgb(r g b / alpha)` of a `#rrggbb` colour, so a shadow follows its colour token. */
const withAlpha = (hex: string, alpha: number) =>
  `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(" ")} / ${alpha})`;

/** A display title's shadows over a painting, in ink. */
export const TEXT_SHADOWS = {
  /** A page or hero title: a hard drop and a soft halo. */
  title: `0 2px 0 ${withAlpha(COLORS.ink, 0.7)}, 0 0 24px ${withAlpha(COLORS.ink, 0.6)}`,
  /** A title on a painting's quiet corner: the drop only. */
  "title-flat": `0 2px 0 ${withAlpha(COLORS.ink, 0.7)}`,
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
