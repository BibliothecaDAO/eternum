import { FONT_FACES, FONTS, SHELL_COLORS } from "@/tokens";
import { AGE_LOCKUP, REALMS_MARK } from "@/ui/design-system/icon-meaning";

/**
 * The brand's surfaces that cannot import the token file: static pages served before or without the app, the docs
 * site, the status page and the player emails. Each holds a copy written from the token file by
 * scripts/build-brand-surfaces.ts, and src/brand/brand.test.ts fails when a copy differs from what it would write.
 * Paths are from the repository's root.
 */
type Face = keyof typeof FONTS;

type Surface =
  /** A page or stylesheet: its block between the brand markers, and its theme-color meta where it has one. */
  | { kind: "css"; path: string; faces: readonly Face[]; fonts?: string }
  /** A data file a surface imports: the colours, faces and marks. */
  | { kind: "json"; path: string };

export const BRAND_SURFACES: readonly Surface[] = [
  { kind: "css", path: "apps/game/index.html", faces: [] },
  { kind: "css", path: "apps/game/public/404.html", faces: ["display", "body"] },
  // Only precached files load offline, and the faces are not precached.
  { kind: "css", path: "apps/game/public/offline.html", faces: [] },
  // Its own static site, with no font service.
  { kind: "css", path: "apps/status/public/index.html", faces: [] },
  {
    kind: "css",
    path: "apps/game-docs/docs/styles.css",
    faces: ["display", "body"],
    fonts: "../../game/public/fonts/",
  },
  { kind: "json", path: "apps/game-docs/docs/brand.gen.json" },
  { kind: "json", path: "packages/notifications/src/brand.gen.json" },
];

const START = "/* brand: written from apps/game/src/tokens.ts by apps/game/scripts/build-brand-surfaces.ts */";
const END = "/* brand: end */";
const THEME_COLOR = /(<meta name="theme-color" content=")[^"]*(")/;

/** A surface's text as the token file writes it: `text` is what it holds now, for a page's own lines. */
export const writeSurface = (surface: Surface, text: string): string =>
  surface.kind === "json" ? `${JSON.stringify(brandFacts(), null, 2)}\n` : writeCssSurface(surface, text);

/** The facts a standalone surface reads: the shell's colours, each face's family and file, and the marks. */
const brandFacts = () => ({
  colors: SHELL_COLORS,
  faces: Object.fromEntries((Object.keys(FONTS) as Face[]).map((face) => [face, faceFacts(face)])),
  marks: { ...REALMS_MARK, lockups: AGE_LOCKUP },
});

const familyOf = (face: Face) => FONTS[face].split(",")[0].replaceAll('"', "").trim();

const faceFacts = (face: Face) => ({
  family: familyOf(face),
  files: FONT_FACES.filter((font) => font.fontFamily === `"${familyOf(face)}"`).map(
    (font) => /url\("([^"]+)"\)/.exec(font.src)![1],
  ),
});

const writeCssSurface = (surface: Extract<Surface, { kind: "css" }>, text: string) => {
  const start = text.indexOf(START);
  const end = text.indexOf(END, start);
  if (start < 0 || end < 0) throw new Error(`${surface.path} holds no brand block (${START} … ${END})`);
  const indent = text.slice(text.lastIndexOf("\n", start) + 1, start);
  const block = cssBlock(surface, indent);
  return (text.slice(0, start) + block + text.slice(end + END.length)).replace(
    THEME_COLOR,
    `$1${SHELL_COLORS.ground}$2`,
  );
};

/** The palette as CSS variables named as the app names them (`--ground`), each face as `--face-<role>`, and the faces. */
const cssBlock = (surface: Extract<Surface, { kind: "css" }>, indent: string) => {
  const lines = [
    START,
    ":root {",
    ...Object.entries(SHELL_COLORS).map(([name, hex]) => `  --${name}: ${hex};`),
    ...surface.faces.map((face) => `  --face-${face}: ${FONTS[face]};`),
    "}",
    ...surface.faces.flatMap((face) => fontFaceRules(face, surface.fonts ?? "/fonts/")),
    END,
  ];
  return lines.join(`\n${indent}`);
};

const fontFaceRules = (face: Face, base: string) =>
  FONT_FACES.filter((font) => font.fontFamily === `"${familyOf(face)}"`).flatMap((font) => [
    "@font-face {",
    `  font-family: ${font.fontFamily};`,
    `  src: ${font.src.replace('url("/fonts/', `url("${base}`)};`,
    `  font-weight: ${font.fontWeight};`,
    `  font-display: ${font.fontDisplay};`,
    "}",
  ]);
