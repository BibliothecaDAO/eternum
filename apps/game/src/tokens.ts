/**
 * The one token file: the kit's colours, the HUD's gold and lines, and the app's three faces. Tailwind reads it (the
 * colours as `kit-*` classes, the faces as `font-ui`, `font-body` and `font-display`) and writes each value as a CSS
 * variable on :root (`--ground`, `--font-ui`), so the HUD's stylesheet and the shell read the same values. Where the
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
  /** The Blitz rating's top three tiers' marks (Storm Lord, Warlord, Conqueror); the lower three wear gold2, gold, muted. */
  stormLord: "#b9a3ff",
  warlord: "#ff7a62",
  conqueror: "#6fb6ff",
} as const;

/**
 * The brand's faces, as the owner chose them (Type 2, 8 October 2026): Bokor for titles, IM FELL English SC for labels
 * and buttons, Atkinson Hyperlegible Next for text and every number. `ui` is one family drawn from two files: its
 * letters are IM FELL, its figures and the marks around them are Atkinson's, so a label and its number need no second
 * class. Cinzel stays banned.
 */
export const FONTS = {
  /** Titles: page and card titles, the countdown, the one display line. */
  display: '"Bokor", serif',
  /** Labels, buttons, chips, the nav; figures inside them come from Atkinson. */
  ui: '"Realms UI", "Atkinson Hyperlegible Next", system-ui, sans-serif',
  /** Text and numbers. */
  body: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
} as const;

/** Figures and the marks that travel with them: digits, , . : % + × − (Atkinson's in the `ui` family). */
const FIGURES = "U+0025, U+002B-002E, U+0030-003A, U+00D7, U+2212";

/**
 * Served from the app (public/fonts), each file as the brand kit or Google Fonts ships it with its licence beside it
 * (public/fonts/SOURCE.md). A face with one weight claims every weight, so a bold label keeps its true letters and is
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
    fontFamily: '"Realms UI"',
    src: 'url("/fonts/im-fell-english-sc-regular.ttf") format("truetype")',
    fontWeight: "100 900",
    fontDisplay: "swap",
  },
  // Declared after the letters, so the figures resolve to Atkinson. The browser joins the two files into one family
  // only when their descriptors match, so the figures claim the same weights as the letters.
  {
    fontFamily: '"Realms UI"',
    src: 'url("/fonts/atkinson-hyperlegible-next.woff2") format("woff2")',
    fontWeight: "100 900",
    unicodeRange: FIGURES,
    fontDisplay: "swap",
  },
] as const;
