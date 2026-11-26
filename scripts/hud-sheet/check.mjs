/**
 * The HUD's sheet guard (`pnpm hud:check`): everything the game draws over the map takes its look from the HUD sheet,
 * its elements (ui/design-system/kit/hud-elements.tsx, hud-sheet.css) and the HUD scope of the token file
 * (apps/game/src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES), never a look of its own: no one-off size, colour, type
 * size or weight. allowlist.json holds, per file, how many such values the migration has still to delete. It is a
 * ratchet: a file past its count fails, a file below its count fails until its line is lowered (`pnpm hud:check
 * --lower` writes the lower counts), and a file not listed may hold none. The migration is done when the list is empty.
 * A raw `<select>` fails wherever it is: no count lets one through.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { configColorsOf } from "../shell-tokens/check.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APP = "apps/game/src";
const ALLOWLIST = new URL("./allowlist.json", import.meta.url);

/**
 * The HUD's code: the interface over the map and its shared atoms, the plates and the order line. Not the sheet itself
 * (the kit), the labs (debug), the shell's doorway, which `shell:check` guards, or the end-of-game share cards, which
 * are exported images.
 */
const SCOPE = ["ui", "three/map-plates", "three/scenes/context-menu", "three/scenes/worldmap-order-tip.tsx"].map(
  (path) => `${APP}/${path}`,
);
const OUTSIDE = [
  "ui/design-system/kit/",
  "ui/debug/",
  "ui/features/debug/",
  "ui/features/game-entry/doorway/",
  // The end-of-game share cards and their PNG export: images on a fixed canvas in their own palette, not HUD.
  "ui/shared/components/blitz-awards-variant-cards.tsx",
  "ui/shared/components/blitz-highlight-card.tsx",
  "ui/shared/components/blitz-leaderboard-card.tsx",
  "ui/shared/components/blitz-map-fingerprint-card.tsx",
  "ui/features/game-review/score-card-content.tsx",
  "ui/shared/lib/blitz-card-shared.ts",
  "ui/shared/lib/share-image.ts",
].map((path) => `${APP}/${path}`);
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

/** A literal colour; a sheet colour read through its channels (`rgb(var(--hud-accent))`) is the sheet's own. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z-])(?:rgba?|hsla?|oklch)\((?!var\(--hud-)/g;
const SURFACE_GROUND = /linear-gradient\(180deg,\s*var\(--hud-surface-from\),\s*var\(--hud-surface-to\)\)/;

/**
 * Each rule, by the value it refuses. `colors` are the Tailwind config's colour names (`gold`, `danger`, the shell's
 * `kit`) but the sheet's own `hud`, `steps` the shell's type steps (TYPE): the HUD reads neither. A `hud-*` colour
 * takes no opacity modifier: each is a role.
 */
export const rules = (colors, steps) => [
  {
    rule: "one-off value: use a HUD element, a hud-* colour or a HUD token",
    pattern: /(?<![\w-])-?[a-z][a-z0-9-]*-\[[^\]\s]+\]/g,
  },
  { rule: "raw colour: use a --hud-* colour", pattern: RAW_COLOR },
  {
    rule: "colour class outside the sheet: use a HUD element or a hud-* colour (text-hud-muted, border-hud-line)",
    pattern: new RegExp(
      `(?<![\\w-])${COLOR_UTILITY}-(?:${[...colors, ...TAILWIND_COLORS].sort((a, b) => b.length - a.length).join("|")})(?:-[a-z0-9_]+)*(?:/\\d+)?(?![\\w-])`,
      "g",
    ),
  },
  {
    rule: "a hud-* colour is a role: no opacity modifier",
    pattern: new RegExp(`(?<![\\w-])${COLOR_UTILITY}-hud-[a-z-]+/\\d+`, "g"),
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
  {
    rule: "a copied kit surface: a Frontier surface takes the kit's class (ui-popover, ui-pill, ui-row) for its rim and ground",
    pattern: new RegExp(SURFACE_GROUND.source, "g"),
    refused: true,
    within: `${APP}/ui/features/frontier/`,
  },
  // The browser draws a native select in its own colours, whatever the HUD's CSS says: the sheet's HudSelect replaces
  // it. No count allows one.
  { rule: "raw <select>: use HudSelect", pattern: /<select(?![\w-])/g, refused: true },
  // A native input takes the browser's white field and pale text, not the sheet's well: HudField, AmountInput or
  // HudNumberField draw it. Counted, so the files that still hold one are moved one at a time.
  { rule: "raw <input>: use HudField", pattern: /<input(?![\w-])/g },
];

/** Every refused value in one file's source, with its line; `refused` when no allowlist count can let it through. */
export const findViolations = (source, path, colors, steps) =>
  source.split("\n").flatMap((text, index) =>
    rules(colors, steps)
      .filter(({ within }) => within === undefined || path.startsWith(within))
      .flatMap(({ rule, pattern, refused = false }) =>
        [...text.matchAll(pattern)].map(([match]) => ({ path, line: index + 1, rule, match, refused })),
      ),
  );

const KIT_SHEET = `${APP}/ui/design-system/kit/hud-sheet.css`;

export const kitSurfaceClasses = (sheet) =>
  new Set(
    [...sheet.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => SURFACE_GROUND.test(body))
      .flatMap(([, selectors]) => selectors.split(",").map((selector) => selector.trim().match(/^\.(ui-[\w-]+)$/)?.[1]))
      .filter((name) => name !== undefined),
  );

const FRONTIER = `${APP}/ui/features/frontier/`;
const isSurfaceReset = (body) =>
  body.split(";").some((declaration) => {
    const [property = "", ...rest] = declaration.split(":");
    const name = property.trim().toLowerCase();
    const tokens = rest
      .join(":")
      .replace(/!important/gi, "")
      .trim()
      .toLowerCase()
      .split(/\s+/);
    if (/^background(?:-color|-image)?$/.test(name))
      return tokens.length === 1 && ["transparent", "none"].includes(tokens[0]);
    if (/^border(?:-(?:top|right|bottom|left|block|inline))?(?:-(?:width|style|color))?$/.test(name))
      return tokens.some((token) => ["0", "0px", "none", "hidden", "transparent"].includes(token));
    return false;
  });
const KIT_ELEMENTS = `${APP}/ui/design-system/kit/hud-elements.tsx`;

const namesIn = (text, surfaces) => text.split(/\s+/).filter((name) => name !== "" && !surfaces.has(name));

const surfacesIn = (text, surfaces) =>
  [...text.matchAll(/[\w-]+/g)].map(([name]) => name).filter((name) => surfaces.has(name));

export const kitSurfaceComponents = (source, surfaces) => {
  const blocks = [
    ...source.matchAll(/^(?:export )?const (\w+) = [\s\S]*?(?=^(?:export )?const \w+ = |$(?![\s\S]))/gm),
  ].map(([block, name]) => ({ name, block }));
  const drawn = new Map(
    blocks.map(({ name, block }) => [name, new Set(surfacesIn(block, surfaces))]).filter(([, found]) => found.size > 0),
  );
  for (let grew = true; grew; ) {
    grew = false;
    for (const { name, block } of blocks)
      for (const [each, found] of [...drawn])
        if (each !== name && new RegExp(`<${each}\\b`).test(block)) {
          const own = drawn.get(name) ?? new Set();
          const before = own.size;
          for (const surface of found) own.add(surface);
          drawn.set(name, own);
          if (own.size > before) grew = true;
        }
  }
  return drawn;
};

const textsIn = (node) => {
  const texts = [];
  const visit = (each) => {
    if (ts.isStringLiteral(each) || ts.isNoSubstitutionTemplateLiteral(each)) texts.push(each.text);
    else if (ts.isTemplateExpression(each)) {
      texts.push(each.head.text);
      for (const span of each.templateSpans) {
        visit(span.expression);
        texts.push(span.literal.text);
      }
    } else ts.forEachChild(each, visit);
  };
  visit(node);
  return texts;
};

const isClassName = (node, file) =>
  (ts.isJsxAttribute(node) || ts.isPropertyAssignment(node)) && node.name.getText(file) === "className";

const tagOf = (attribute, file) => {
  const element = attribute.parent?.parent;
  return element && (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element))
    ? element.tagName.getText(file)
    : null;
};

export const surfaceCompanions = (source, surfaces, components = new Map()) => {
  const file = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const companions = new Map();
  const visit = (node) => {
    if (isClassName(node, file) && node.initializer) {
      const texts = textsIn(node.initializer);
      const drawn = new Set([
        ...texts.flatMap((text) => surfacesIn(text, surfaces)),
        ...(components.get(tagOf(node, file)) ?? []),
      ]);
      if (drawn.size > 0)
        for (const name of texts.flatMap((text) => namesIn(text, surfaces))) {
          const own = companions.get(name) ?? new Set();
          for (const surface of drawn) own.add(surface);
          companions.set(name, own);
        }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return companions;
};

const topLevelSelectors = (text) => {
  const selectors = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === "(") depth += 1;
    else if (text[at] === ")") depth -= 1;
    else if (text[at] === "," && depth === 0) {
      selectors.push(text.slice(from, at));
      from = at + 1;
    }
  }
  return [...selectors, text.slice(from)].map((selector) => selector.trim());
};

const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

export const findSurfaceResets = (source, path, companions, surfaces) =>
  [...withoutComments(source).matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(({ 1: selectors, 2: body, index }) => {
    if (!isSurfaceReset(body)) return [];
    const line = source.slice(0, index + selectors.length - selectors.trimStart().length).split("\n").length;
    return topLevelSelectors(selectors).flatMap((selector) => {
      const subject = selector.split(/[\s>+~]+(?![^(]*\))/).at(-1) ?? "";
      if (/::[\w-]+/.test(subject)) return [];
      const named = [...subject.matchAll(/\.([\w-]+)/g)].map(([, name]) => name);
      const excluded = new Set(
        [...subject.matchAll(/:not\(([^)]*)\)/g)].flatMap(([, inner]) =>
          [...inner.matchAll(/\.([\w-]+)/g)].map(([, name]) => name),
        ),
      );
      const reached =
        named.length === 0
          ? [...surfaces]
          : named.flatMap((name) => (surfaces.has(name) ? [name] : [...(companions.get(name) ?? [])]));
      const wiped = new Set(reached.filter((surface) => !excluded.has(surface)));
      if (wiped.size === 0) return [];
      return [
        {
          path,
          line,
          rule: `a feature reset over a kit surface: scope it to ${[...wiped].map((surface) => `:not(.${surface})`).join("")} so it never wipes the kit's ground and rim`,
          match: selector,
          refused: true,
        },
      ];
    });
  });

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
  const colors = [
    ...configColorsOf(readFileSync(join(ROOT, "apps/game/tailwind.config.js"), "utf8")).filter(
      (name) => name !== "hud",
    ),
    "kit",
  ];
  const steps = stepsOf(readFileSync(join(ROOT, APP, "tokens.ts"), "utf8"));
  const allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  const found = SCOPE.flatMap(filesUnder).flatMap((path) =>
    findViolations(readFileSync(join(ROOT, path), "utf8"), path, colors, steps),
  );
  const frontier = filesUnder(FRONTIER);
  const surfaces = kitSurfaceClasses(readFileSync(join(ROOT, KIT_SHEET), "utf8"));
  if (surfaces.size === 0) {
    console.error(`${KIT_SHEET}: no kit class paints the surface ground, so no reset over a kit surface can be found`);
    process.exit(1);
  }
  const components = kitSurfaceComponents(readFileSync(join(ROOT, KIT_ELEMENTS), "utf8"), surfaces);
  const companions = new Map();
  for (const path of frontier.filter((each) => each.endsWith(".tsx")))
    for (const [name, drawn] of surfaceCompanions(readFileSync(join(ROOT, path), "utf8"), surfaces, components))
      companions.set(name, new Set([...(companions.get(name) ?? []), ...drawn]));
  const resets = frontier
    .filter((path) => path.endsWith(".css"))
    .flatMap((path) => findSurfaceResets(readFileSync(join(ROOT, path), "utf8"), path, companions, surfaces));
  const refused = [...found, ...resets].filter((violation) => violation.refused);
  const violations = found.filter((violation) => !violation.refused);
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
  for (const { path, line, rule, match } of refused) console.error(`${path}:${line} ${match}: ${rule}`);
  if (over.length || under.length || refused.length) process.exit(1);
  console.log(`HUD sheet: ${violations.length} one-off looks left in ${counts.size} files, none new.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
