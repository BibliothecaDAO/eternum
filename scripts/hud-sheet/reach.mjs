/**
 * The migrated areas' guard (`pnpm hud:check` runs it after the sheet guard): a HUD area is on the sheet when nothing
 * it renders, itself or through what it imports, still draws a look of its own or a control the sheet replaced. It
 * follows each area's imports, each imported name to the file that defines it (through barrels, never a type), and
 * fails on any module that still holds one-off looks (a line in allowlist.json) or is RETIRED, however it looks now: the
 * sheet's element is the one way. A module another area still has to migrate is named in WAITING with its owner; the
 * list only shrinks: a waiting module no area reaches any more, or one that is no longer old, fails until its line goes.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APP = "apps/game/src";
const ALLOWLIST = new URL("./allowlist.json", import.meta.url);

/** Each migrated area by the folders and files it owns. An area joins when its migration lands. */
const AREAS = {
  "B. Windows and modals": [
    "ui/features/settlement",
    "ui/features/relics",
    "ui/features/progression/hints",
    "ui/features/economy/trading",
    "ui/features/economy/banking",
    "ui/features/event-feed",
    "ui/features/economy/resources/craft-relic-popup.tsx",
    "ui/features/economy/resources/relic-activation-popup.tsx",
    "ui/features/world/components/structure-edit-popup.tsx",
    "ui/features/world/containers/construction-modal.tsx",
    "ui/features/world/containers/military-modal.tsx",
  ],
  "C. Transfer": ["ui/features/economy/transfers", "ui/features/economy/resources"],
};

/** Modules an area renders that another area has still to migrate, each with the area that owns it. */
const WAITING = {
  "ui/design-system/atoms/hud-typography.ts": "A (hud): the structure sidebar's type",
  "ui/features/world/components/structure-status-row/structure-status-row.tsx": "A (hud)",
  "ui/features/world/containers/left-facets/structure-category-filter.tsx": "A (hud)",
  "ui/features/world/containers/top-header/structure-groups.ts": "A (hud)",
  "ui/features/world/components/entities/hooks/use-structure-entity-detail.ts": "A (hud)",
  "ui/features/military/components/troop-chip.tsx": "D (rings)",
  "ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx": "D (rings)",
  "ui/features/military/components/unified-army-creation-modal/existing-armies-panel.tsx": "D (rings)",
  "ui/design-system/molecules/requirement-chips.tsx": "F (shell)",
  "ui/shared/components/production-status-badge.tsx": "F (shell)",
};

/**
 * The controls the sheet replaced, by module or folder: the HUD reaches none of them even once they draw the sheet's
 * look (the shell's pages keep the kit's). Each names the sheet element that took its place.
 */
const RETIRED = {
  "ui/design-system/atoms/button": "HudButton",
  "ui/design-system/atoms/max-button": "HudButton",
  "ui/design-system/atoms/checkbox": "HudCheck",
  "ui/design-system/atoms/number-input": "HudNumberField",
  "ui/design-system/atoms/select": "HudSelect",
  "ui/design-system/atoms/text-input": "HudField",
  "ui/design-system/atoms/tab": "HudTabs",
  "ui/design-system/atoms/overlay-surface": "HudPanel, HudWindow",
  "ui/design-system/atoms/hud-typography": "the text-hud-* roles",
  "ui/design-system/molecules/circle-button": "HudIconButton",
  "ui/design-system/kit/sheet": "HudSheet",
  "ui/design-system/kit/button": "HudButton",
  "ui/design-system/kit/chip": "HudChip",
  "ui/design-system/kit/store-bar": "HudMeter",
  "ui/design-system/kit/price-chip": "HudButton prices",
  "ui/design-system/kit/refused-verb": "a disabled HudButton and its HudNotice",
};

/** Whether an app file is a retired control, or inside a retired folder (the old tabs), whatever it draws now. */
export const isRetired = (path) => {
  const module = path.replace(/\.tsx?$/, "").replace(/\/index$/, "");
  return Object.keys(RETIRED).some((retired) => module === retired || module.startsWith(`${retired}/`));
};

/** Files the sheet guard counts that draw nothing: the class-name merge its colour roles are taught to. */
const NOT_A_LOOK = new Set(["ui/design-system/atoms/lib/utils.ts"]);

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const isTest = (path) => /\.test\.tsx?$/.test(path);

/** A module specifier as a file under the app, or null for a package. */
const resolveSpecifier = (app, from, specifier) => {
  const base = specifier.startsWith("@/")
    ? join(app, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  const found = EXTENSIONS.map((extension) => base + extension).find(
    (path) => existsSync(path) && statSync(path).isFile(),
  );
  return found ?? null;
};

/** The import graph of an app folder: each module's value imports, at the files that define them. */
export const importGraph = (app) => {
  const sources = new Map();
  const source = (file) => {
    if (!sources.has(file)) sources.set(file, readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""));
    return sources.get(file);
  };

  /** The file defining `name` as a value, through `export … from` re-exports; null when it is only a type. */
  const definer = (file, name, seen = new Set()) => {
    if (seen.has(file)) return null;
    seen.add(file);
    const text = source(file);
    if (new RegExp(`export\\s+(?:declare\\s+)?(?:type|interface)\\s+${name}\\b`).test(text)) return null;
    const declares = `export\\s+(?:default\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class|enum)\\s+${name}\\b`;
    if (new RegExp(declares).test(text)) return file;
    for (const [, names, specifier] of text.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      for (const part of names.split(",").map((each) => each.trim())) {
        if (part.startsWith("type ")) continue;
        const [original, alias] = part.split(/\s+as\s+/);
        if ((alias ?? original) !== name) continue;
        const target = resolveSpecifier(app, file, specifier);
        return target ? (definer(target, original, seen) ?? target) : null;
      }
    }
    if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text)) return file;
    for (const [, specifier] of text.matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g)) {
      const target = resolveSpecifier(app, file, specifier);
      const found = target && definer(target, name, seen);
      if (found) return found;
    }
    return null;
  };

  /** The files a module draws on: a default, namespace, dynamic or side-effect import whole, a named one where defined. */
  return (file) => {
    const edges = new Set();
    for (const [, typeOnly, clause, specifier] of source(file).matchAll(
      /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g,
    )) {
      const target = !typeOnly && resolveSpecifier(app, file, specifier);
      if (!target) continue;
      const named = clause.match(/\{([^}]*)\}/);
      if (
        clause
          .replace(/\{[^}]*\}/, "")
          .replace(/,/g, "")
          .trim()
      )
        edges.add(target);
      for (const part of named ? named[1].split(",").map((each) => each.trim()) : []) {
        if (!part || part.startsWith("type ")) continue;
        const found = definer(target, part.split(/\s+as\s+/)[0]);
        if (found) edges.add(found);
      }
    }
    for (const [, dynamic, bare] of source(file).matchAll(
      /import\(\s*["']([^"']+)["']\s*\)|^import\s+["']([^"']+)["']/gm,
    )) {
      const target = resolveSpecifier(app, file, dynamic ?? bare);
      if (target) edges.add(target);
    }
    return [...edges].filter((target) => !isTest(target));
  };
};

/**
 * Every legacy module the roots reach, each with one import path to it from a root. The walk stops at a legacy
 * module: what it imports is its owner's to migrate.
 */
export const legacyReached = (roots, edgesOf, isLegacy) => {
  const parent = new Map(roots.map((root) => [root, null]));
  const queue = [...roots];
  const reached = new Set(roots.filter(isLegacy));
  while (queue.length > 0) {
    const file = queue.shift();
    for (const target of edgesOf(file)) {
      if (parent.has(target)) continue;
      parent.set(target, file);
      if (isLegacy(target)) reached.add(target);
      else queue.push(target);
    }
  }
  const pathTo = (file) => {
    const path = [];
    for (let at = file; at; at = parent.get(at)) path.unshift(at);
    return path;
  };
  return [...reached].sort().map((file) => ({ file, path: pathTo(file) }));
};

/** What fails: a legacy module an area reaches that waits on no one, and a waiting line that no longer applies. */
export const verdict = (reachedByArea, waiting, isLegacy) => {
  const reachedAnywhere = new Set(Object.values(reachedByArea).flatMap((reached) => reached.map(({ file }) => file)));
  const unowned = Object.entries(reachedByArea).flatMap(([area, reached]) =>
    reached.filter(({ file }) => !(file in waiting)).map((each) => ({ area, ...each })),
  );
  const stale = Object.keys(waiting).filter((file) => !reachedAnywhere.has(file) || !isLegacy(file));
  return { unowned, stale };
};

const filesUnder = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((name) => filesUnder(join(path, name)))
    : /\.tsx?$/.test(path) && !isTest(path)
      ? [path]
      : [];

const main = () => {
  const app = join(ROOT, APP);
  const allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
  const inApp = (file) => relative(app, file);
  const isLegacy = (file) => {
    const path = inApp(file);
    if (NOT_A_LOOK.has(path)) return false;
    if (allowlist[`${APP}/${path}`]) return true;
    return isRetired(path);
  };
  const edgesOf = importGraph(app);
  const reachedByArea = Object.fromEntries(
    Object.entries(AREAS).map(([area, roots]) => [
      area,
      legacyReached(
        roots.flatMap((root) => filesUnder(join(app, root))),
        edgesOf,
        isLegacy,
      ).map(({ file, path }) => ({ file: inApp(file), path: path.map(inApp) })),
    ]),
  );
  const { unowned, stale } = verdict(reachedByArea, WAITING, (path) => isLegacy(join(app, path)));
  for (const { area, path } of unowned) console.error(`${area} renders an old look: ${path.join(" → ")}`);
  for (const file of stale)
    console.error(`WAITING names ${file}, which no migrated area reaches with a look: delete its line`);
  const waits = Object.values(reachedByArea)
    .flat()
    .filter(({ file }) => file in WAITING).length;
  console.log(
    `HUD areas: ${Object.keys(AREAS).length} on the sheet, ${waits} renders waiting on ${Object.keys(WAITING).length} modules of other areas.`,
  );
  if (unowned.length || stale.length) process.exit(1);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
