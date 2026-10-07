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
} as const;

/** The dyslexia rule's faces: Lexend for titles, numbers and buttons, Atkinson for body, IM Fell only for display. */
export const FONTS = {
  /** The lockup's word and one display line of 24 px or more on a painted screen; nothing else. */
  display: '"IM Fell English SC", serif',
  ui: '"Lexend", system-ui, sans-serif',
  body: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
} as const;

/** Served from the app (public/fonts), so no page asks a font service. Variable weights where the face has them. */
export const FONT_FACES = [
  {
    fontFamily: '"Lexend"',
    src: 'url("/fonts/lexend.woff2") format("woff2")',
    fontWeight: "100 900",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"Atkinson Hyperlegible Next"',
    src: 'url("/fonts/atkinson-hyperlegible-next.woff2") format("woff2")',
    fontWeight: "200 800",
    fontDisplay: "swap",
  },
  {
    fontFamily: '"IM Fell English SC"',
    src: 'url("/fonts/im-fell-english-sc.woff2") format("woff2")',
    fontWeight: "400",
    fontDisplay: "swap",
  },
] as const;
