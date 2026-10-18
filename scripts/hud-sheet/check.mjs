/**
 * The HUD's sheet guard (`pnpm hud:check`): everything the game draws over the map takes its look from the HUD sheet,
 * its elements (ui/design-system/kit/hud-elements.tsx, hud-sheet.css) and the HUD scope of the token file
 * (apps/game/src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES), never a look of its own: no one-off size, colour, type
 * size or weight. allowlist.json holds, per file, how many such values the migration has still to delete. It is a
 * ratchet: a file past its count fails, a file below its count fails until its line is lowered (`pnpm hud:check
 * --lower` writes the lower counts), and a file not listed may hold none. The migration is done when the list is empty.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { configColorsOf } from "../shell-tokens/check.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APP = "apps/game/src";
const ALLOWLIST = new URL("./allowlist.json", import.meta.url);

/**
 * The HUD's code: the interface over the map and its shared atoms, the plates and the order line. Not the sheet itself
 * (the kit), the labs (debug) or the shell's doorway, which `shell:check` guards.
 */
const SCOPE = ["ui", "three/map-plates", "three/scenes/context-menu", "three/scenes/worldmap-order-tip.tsx"].map(
  (path) => `${APP}/${path}`,
);
const OUTSIDE = ["ui/design-system/kit/", "ui/debug/", "ui/features/debug/", "ui/features/game-entry/doorway/"].map(
  (dir) => `${APP}/${dir}`,
);
const isScanned = (path) =>
  /\.(?:tsx?|css)$/.test(path) && !/\.test\.tsx?$/.test(path) && !OUTSIDE.some((dir) => path.startsWith(dir));

/** Tailwind's default colour families. */
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

const COLOR_UTILITY =
  "(?:bg|text|border(?:-[xytrblse])?|from|via|to|ring(?:-offset)?|outline|fill|stroke|decoration|divide|caret|accent|placeholder|shadow)";

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z-])(?:rgba?|hsla?|oklch)\(/g;

/**
 * Each rule, by the value it refuses. `colors` are the Tailwind config's colour names (`gold`, `danger`, the shell's
 * `kit`), `steps` the shell's type steps (TYPE): the HUD reads neither.
 */
export const rules = (colors, steps) => [
  {
    rule: "one-off value: use a HUD element or a --hud-* token",
    pattern: /(?<![\w-])-?[a-z][a-z0-9-]*-\[[^\]\s]+\]/g,
    allows: (match) => match.includes("var(--hud-"),
  },
  { rule: "raw colour: use a --hud-* colour", pattern: RAW_COLOR },
  {
    rule: "colour class outside the sheet: use a HUD element or a --hud-* colour",
    pattern: new RegExp(
      `(?<![\\w-])${COLOR_UTILITY}-(?:${[...colors, ...TAILWIND_COLORS].sort((a, b) => b.length - a.length).join("|")})(?:-[a-z0-9_]+)*(?:/\\d+)?(?![\\w-])`,
      "g",
    ),
  },
  {
    rule: "type size outside the sheet: use text-hud-<role> (HUD_TYPE)",
    pattern: new RegExp(
      `(?<![\\w-])text-(?:xxs|xs|sm|base|lg|[2-9]?xl|${steps.sort((a, b) => b.length - a.length).join("|")})(?![\\w-])`,
      "g",
    ),
  },
  {
    rule: "weight outside the sheet: a HUD_TYPE role carries its weight",
    pattern: /(?<![\w-])font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?![\w-])/g,
  },
  { rule: "literal font size: use --hud-text-<role>", pattern: /font-size:\s*[\d.]+(?:px|rem)/g },
];

/** Every refused value in one file's source, with its line. */
export const findViolations = (source, path, colors, steps) =>
  source.split("\n").flatMap((text, index) =>
    rules(colors, steps).flatMap(({ rule, pattern, allows }) =>
      [...text.matchAll(pattern)]
        .map(([match]) => match)
        .filter((match) => !allows?.(match))
        .map((match) => ({ path, line: index + 1, rule, match })),
    ),
  );

/** Each file's count against its line: over it fails, under it fails until the line is lowered. */
export const ratchet = (counts, allowlist) => {
  const over = [...counts].filter(([file, count]) => count > (allowlist[file] ?? 0));
  const under = Object.entries(allowlist).filter(([file, listed]) => (counts.get(file) ?? 0) < listed);
  return { over, under };
};

/** The allowlist with every count lowered to the file's own, and a file holding none dropped; never raised. */
export const lowered = (counts, allowlist) =>
  Object.fromEntries(
    Object.entries(allowlist)
      .map(([file, listed]) => [file, Math.min(listed, counts.get(file) ?? 0)])
      .filter(([, count]) => count > 0),
  );

/** The shell's type step names (TYPE's keys), read from the token file's source. */
export const stepsOf = (tokensSource) => {
  const block = tokensSource.match(/export const TYPE = \{([\s\S]*?)\n\} as const;/);
  if (!block) throw new Error("TYPE not found in apps/game/src/tokens.ts");
  return [...block[1].matchAll(/^\s{2}"?([a-z][\w-]*)"?:/gm)].map(([, name]) => name);
};

const filesUnder = (path) =>
  /\.\w+$/.test(path)
    ? [path]
    : readdirSync(join(ROOT, path), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
        .filter(isScanned);

const main = () => {
  const colors = [...configColorsOf(readFileSync(join(ROOT, "apps/game/tailwind.config.js"), "utf8")), "kit"];
  const steps = stepsOf(readFileSync(join(ROOT, APP, "tokens.ts"), "utf8"));
  const allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  const violations = SCOPE.flatMap(filesUnder).flatMap((path) =>
    findViolations(readFileSync(join(ROOT, path), "utf8"), path, colors, steps),
  );
  const counts = new Map();
  for (const { path } of violations) counts.set(path, (counts.get(path) ?? 0) + 1);

  if (process.argv.includes("--lower")) {
    writeFileSync(ALLOWLIST, `${JSON.stringify(lowered(counts, allowlist), null, 2)}\n`);
    return;
  }
  const { over, under } = ratchet(counts, allowlist);
  for (const [file, count] of over) {
    console.error(`${file}: ${count} one-off looks, ${allowlist[file] ?? 0} allowed:`);
    for (const { line, rule, match } of violations.filter(({ path }) => path === file))
      console.error(`  ${file}:${line} ${match}: ${rule}`);
  }
  for (const [file, listed] of under)
    console.error(`${file}: ${counts.get(file) ?? 0} left, listed ${listed}: run pnpm hud:check --lower`);
  if (over.length || under.length) process.exit(1);
  console.log(`HUD sheet: ${violations.length} one-off looks left in ${counts.size} files, none new.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
