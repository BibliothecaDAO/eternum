/**
 * The shell's token guard (`pnpm shell:check`): the shell's code names its sizes, colours, radii, shadows, gradients,
 * faces and wide screen through the token file (apps/game/src/tokens.ts) and its Tailwind classes, never as one-off
 * values, and the index.css classes the shell renders draw only the token file's variables. Each exception still in the
 * code is listed in allowlist.json with its reason and the issue that will remove it; the check also fails on a listed
 * exception that no longer exists, so the list only shrinks.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APP = "apps/game/src";
const STYLESHEET = `${APP}/index.css`;

/** The shell's code: the shell, the doorway, the install prompt and the kit it shares with the HUD. */
const SCOPE = ["shell", "ui/features/game-entry/doorway", "pwa", "ui/design-system/kit"].map((dir) => `${APP}/${dir}`);
const isScanned = (path) =>
  /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.startsWith(`${APP}/shell/generated/`);

/** Tailwind's own `font-*` classes: its family names and its weights. */
const TAILWIND_FONTS = [
  "sans",
  "serif",
  "mono",
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
];

/** Tailwind's default colour families: a class in one bypasses the palette. */
const TAILWIND_COLORS = [
  "black",
  "white",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

/** Every utility that takes a colour (a shadow's own rule refuses an arbitrary shadow whole). */
const COLOR_UTILITY =
  "(?:bg|text|border(?:-[xytrblse])?|from|via|to|ring(?:-offset)?|outline|fill|stroke|decoration|divide|caret|accent|placeholder)";

/** A literal colour or image: `#hex`, a colour function, `url(`. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z-])(?:rgba?|hsla?|oklch)\(/g;

/**
 * Each rule, by the value it refuses and where that value belongs instead. `colors` are the colour names the Tailwind
 * config defines beside the palette (`gold`, `danger`): the HUD's, so a shell class in one bypasses the shell's palette.
 */
export const rules = (fonts, colors = []) => [
  {
    rule: "arbitrary text size: use a TYPE step (text-caption … text-figure)",
    pattern: /\btext-\[[\d.]+(?:px|rem)\]/g,
  },
  { rule: "raw colour: use a palette colour (kit-*)", pattern: RAW_COLOR },
  {
    rule: "colour outside the palette: use a kit-* colour (SHELL_COLORS)",
    pattern: new RegExp(
      `(?<![\\w-])(?:${COLOR_UTILITY}|shadow)-(?:${[...colors, ...TAILWIND_COLORS].sort((a, b) => b.length - a.length).join("|")})(?:-[a-z0-9_]+)*(?![\\w-])`,
      "g",
    ),
  },
  {
    rule: "arbitrary colour or gradient: use a palette colour (kit-*) or a gradient token (bg-grade … bg-rays)",
    pattern: new RegExp(`(?<![\\w-])${COLOR_UTILITY}-\\[[^\\]]*(?:theme\\(colors|gradient\\(|url\\()[^\\]]*\\]`, "g"),
  },
  {
    rule: "arbitrary shadow: use a shadow token (shadow-mark … shadow-glow)",
    pattern: /(?<![\w-])(?:drop-)?shadow-\[(?!var\(--)[^\]]*\]/g,
  },
  { rule: "arbitrary radius: use a RADII token (rounded-key … rounded-plate)", pattern: /\brounded-\[[^\]]*\]/g },
  { rule: "arbitrary wide screen: use wide:", pattern: /\bmin-\[1800px\]:/g },
  {
    rule: "unknown face: use a FONTS face (font-display, font-ui, font-body) or a Tailwind weight",
    pattern: /(?<![\w-])font-(?:\[[^\]]*\]|[a-z][\w-]*)/g,
    allows: (match) => [...fonts, ...TAILWIND_FONTS].includes(match.slice("font-".length)),
  },
];

/** Every refused value in one file's source, with its line. */
export const findViolations = (source, path, fonts, colors = []) =>
  source.split("\n").flatMap((text, index) =>
    rules(fonts, colors).flatMap(({ rule, pattern, allows }) =>
      [...text.matchAll(pattern)]
        .map(([match]) => match)
        .filter((match) => !allows?.(match))
        .map((match) => ({ path, line: index + 1, rule, match })),
    ),
  );

/**
 * index.css's classes the shell renders (the kit's button, sheet, card, chip and the plate family) and the base text
 * styles it inherits: they draw the token file's variables (`var(--primary-face)`), so each surface's values apply.
 */
export const SHELL_CLASSES = [
  "frontier-primary",
  "frontier-sheet",
  "frontier-handle",
  "frontier-card",
  "frontier-chip",
  "frontier-chip-number",
  "plate",
  "plate-title",
  "painted",
  "leather",
];

const isShellSelector = (selector) =>
  new RegExp(`(?:^|[\\s,>+~(])\\.(?:${SHELL_CLASSES.join("|")})(?![\\w-])`).test(selector) ||
  selector.split(",").some((part) => /^\s*(?:html|body)\s*$/.test(part));

const STYLESHEET_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z-])(?:rgba?|hsla?|oklch|url|theme)\(/g;

/** Every literal colour, image or theme() in the shell's index.css rules, with its line. */
export const findStylesheetViolations = (source, path) => {
  // Comments become spaces (newlines kept), so a comment's words never read as a selector and lines still count.
  const css = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const lineAt = (offset) => css.slice(0, offset).split("\n").length;
  return [...css.matchAll(/([^{};]*)\{([^{}]*)\}/g)]
    .filter(([, selector]) => isShellSelector(selector.trim()))
    .flatMap((block) => {
      const bodyAt = block.index + block[0].indexOf("{") + 1;
      return [...block[2].matchAll(STYLESHEET_LITERAL)].map((literal) => ({
        path,
        line: lineAt(bodyAt + literal.index),
        rule: "literal in a shell class: name it in tokens.ts (SHELL_FINISH) and read its var(--…)",
        match: literal[0],
      }));
    });
};

/**
 * What the allowlist does not account for: each violation past its entry's count, and each entry whose value is no
 * longer in its file as often as listed (fixed sites leave the list).
 */
export const unlisted = (violations, allowlist) => {
  const counts = new Map();
  for (const { path, match } of violations) counts.set(`${path} ${match}`, (counts.get(`${path} ${match}`) ?? 0) + 1);
  const listed = new Map(allowlist.map((entry) => [`${entry.file} ${entry.match}`, entry]));
  const extra = violations.filter(
    ({ path, match }) => (counts.get(`${path} ${match}`) ?? 0) > (listed.get(`${path} ${match}`)?.count ?? 0),
  );
  const stale = allowlist.filter((entry) => (counts.get(`${entry.file} ${entry.match}`) ?? 0) < entry.count);
  return { extra, stale };
};

/** The face names the token file defines (FONTS' keys), read from its source so this check needs no build. */
export const fontsOf = (tokensSource) => {
  const block = tokensSource.match(/export const FONTS = \{([\s\S]*?)\n\} as const;/);
  if (!block) throw new Error("FONTS not found in apps/game/src/tokens.ts");
  return [...block[1].matchAll(/^\s{2}([a-z][\w-]*):/gm)].map(([, name]) => name);
};

/** The shell's palettes: the shell kit's (`kit`) and the app sheet's colour roles (`app`, src/tokens.ts APP_SHEET). */
const SHELL_PALETTES = ["kit", "app"];

/** The colour names the Tailwind config defines beside the shell's palettes, read from its source. */
export const configColorsOf = (configSource) => {
  const block = configSource.match(/\n {6}colors: \{\n([\s\S]*?)\n {6}\},/);
  if (!block) throw new Error("colors not found in apps/game/tailwind.config.js");
  return [...block[1].matchAll(/^ {8}"?([a-z][\w-]*)"?:/gm)]
    .map(([, name]) => name)
    .filter((name) => !SHELL_PALETTES.includes(name));
};

const filesUnder = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter(isScanned);

const main = () => {
  const fonts = fontsOf(readFileSync(join(ROOT, APP, "tokens.ts"), "utf8"));
  const colors = configColorsOf(readFileSync(join(ROOT, "apps/game/tailwind.config.js"), "utf8"));
  const allowlist = JSON.parse(readFileSync(new URL("./allowlist.json", import.meta.url), "utf8"));
  const violations = [
    ...SCOPE.flatMap(filesUnder).flatMap((path) =>
      findViolations(readFileSync(join(ROOT, path), "utf8"), path, fonts, colors),
    ),
    ...findStylesheetViolations(readFileSync(join(ROOT, STYLESHEET), "utf8"), STYLESHEET),
  ];
  const { extra, stale } = unlisted(violations, allowlist);
  for (const { path, line, rule, match } of extra) console.error(`${path}:${line} ${match}: ${rule}`);
  for (const { file, match, count } of stale)
    console.error(`${file} ${match}: listed ${count}× in scripts/shell-tokens/allowlist.json but fixed; remove it`);
  if (extra.length || stale.length) process.exit(1);
  console.log(`Shell tokens: ${violations.length} listed exceptions, nothing else.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
