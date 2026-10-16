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
} as const;

/**
 * The app's two faces (decisions-1, 14 October 2026): Bokor for page and card titles only, and Atkinson Hyperlegible
 * Next for everything read (labels, buttons, text, numbers), in sentence case, upright and untracked. The Blitz and
 * Eternum HUD reads in its own faces (CLASSIC_HUD_FONTS).
 */
export const FONTS = {
  /** Titles: page and card titles, the one display line of a page. */
  display: '"Bokor", serif',
  /** Everything read. */
  body: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
} as const;

/**
 * The Blitz and Eternum HUD's faces (its War room skin, 16 October 2026), as CSS variables under html.classic-hud only:
 * Exo 2 for everything read there (--font-ui, also `font-ui`), Cinzel for its panel titles (--font-hud-title).
 */
export const CLASSIC_HUD_FONTS = {
  ui: '"Exo 2", "Atkinson Hyperlegible Next", system-ui, sans-serif',
  "hud-title": '"Cinzel", serif',
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
  {
    fontFamily: '"Cinzel"',
    src: 'url("/fonts/cinzel.woff2") format("woff2")',
    fontWeight: "400 900",
    fontDisplay: "swap",
  },
] as const;
