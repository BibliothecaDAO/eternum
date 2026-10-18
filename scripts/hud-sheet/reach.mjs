/**
 * The migrated areas' guard (`pnpm hud:check` runs it after the sheet guard): a HUD area is on the sheet when nothing
 * it renders, itself or through anything it imports (another area's child included, not only shared wrappers), still
 * draws a look of its own or a control the sheet replaced. It follows each area's imports, each imported name to the
 * file that defines it (through barrels, never a type), and fails on any module that still holds one-off looks (a
 * line in allowlist.json) or is retired, however it looks now: the old atoms, InfoBubble, and every kit component but
 * what the sheet itself is made of. A module another area still has to migrate is named in WAITING with its owner; the
 * list only shrinks: a waiting module no area reaches any more, or one that is no longer old, fails until its line goes.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APP = "apps/game/src";
const ALLOWLIST = new URL("./allowlist.json", import.meta.url);

/**
 * Each migrated area by the folders and files it owns. An area joins in the change that lands its migration on this
 * branch (B, C and D add theirs as they land).
 */
const AREAS = {
  "A. Panels": [
    "ui/features/world/hud/desktop-hud.tsx",
    "ui/features/world/hud/guided-rail.tsx",
    "ui/features/world/hud/next-up.tsx",
    "ui/features/world/hud/events-card.tsx",
    "ui/features/world/hud/idle-armies.tsx",
    "ui/features/world/hud/holdings.tsx",
    "ui/features/world/hud/realm-card.tsx",
    "ui/features/world/hud/minimap.tsx",
    "ui/features/world/containers/top-header",
    "ui/features/world/containers/left-facets",
    "ui/features/world/containers/left-view-surfaces.tsx",
    "ui/features/world/containers/compact-hud.tsx",
    "ui/features/world/containers/structure-sidebar.tsx",
    "ui/features/world/components/bottom-right-panel",
    "ui/features/world/components/entities",
    "ui/features/world/components/structure-status-row",
    "ui/features/world/components/biome-info-panel.tsx",
    "ui/features/world/components/armies",
    "ui/features/world/components/hyperstructures",
    "ui/features/world/components/actions/selected-worldmap-entity.tsx",
    "ui/features/world/components/actions/chest-tile-details.tsx",
    "ui/features/world/components/actions/bitcoin-mining-action-panel.tsx",
    "ui/features/world/components/actions/faith-devotion-action-panel.tsx",
    "ui/features/world/components/actions/unoccupied-tile-quadrants.tsx",
    "ui/features/frontier/frontier-hud.tsx",
    "ui/features/frontier/frontier-selection-sheet.tsx",
    "ui/features/frontier/frontier-spire-sheet.tsx",
    "ui/features/frontier/full-in.tsx",
    "ui/features/frontier/hud",
    "ui/features/frontier/army",
    "ui/features/frontier/sites",
    "ui/features/frontier/build",
  ],
  "E. Map plates, order line, structure menu": [
    "three/map-plates",
    "three/scenes/context-menu",
    "three/scenes/worldmap-order-tip.tsx",
    "ui/features/world/components/context-menu",
  ],
  "F. Shared surfaces": [
    "ui/modules/settings",
    "ui/modules/boot-loader",
    "ui/modules/loading-screen.tsx",
    "ui/modules/loading-oroborus.tsx",
    "ui/modules/construction-gate.tsx",
    "ui/modules/entity-details/realm/realm-details.tsx",
    "ui/shared/error-boundary.tsx",
    "ui/shared/components/world-loading.tsx",
    "ui/shared/components/count-up-number.tsx",
    "ui/features/news-headlines",
    "ui/features/game-entry/realm-number-picker.tsx",
    "ui/motion",
    "ui/design-system/hex-marker.tsx",
    "ui/design-system/molecules/headline.tsx",
    "ui/design-system/molecules/popover.tsx",
    "ui/design-system/molecules/requirement-chips.tsx",
    "ui/design-system/molecules/resource-cost.tsx",
    "ui/design-system/molecules/structure-select.tsx",
    "ui/design-system/molecules/structure-workspace.tsx",
    "ui/design-system/molecules/tooltip.tsx",
  ],
  "B. Windows and modals": [
    "ui/features/settlement",
    "ui/features/relics",
    "ui/features/progression/hints",
    "ui/features/economy/trading",
    "ui/features/economy/banking",
    "ui/features/event-feed",
    "ui/features/frontier/upgrade",
    "ui/features/frontier/guide",
    "ui/features/world/components/structure-edit-popup.tsx",
    "ui/features/world/containers/construction-modal.tsx",
    "ui/features/world/containers/military-modal.tsx",
  ],
  "C. Transfer": ["ui/features/economy/transfers", "ui/features/economy/resources"],
};

/** Modules an area renders that another area has still to migrate, each with the area that owns it. */
const WAITING = {
  "ui/features/economy/trading/market-modal.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/economy/transfers/transfer-window.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/event-feed/event-log-panel.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/event-feed/story-feed-row.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/frontier/guide/guide-card.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/frontier/guide/guide-lines-sheet.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/frontier/guide/guide-thread.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/frontier/upgrade/castle-view.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/frontier/upgrade/training-gives.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/frontier/upgrade/type-upgrade-sheet.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/relics/components/relic-activation-selector.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/settlement/construction/select-preview-building.tsx":
    "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/settlement/production/automation-preset-switch.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/settlement/production/production-modal-content.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/settlement/production/resource-production-controls.tsx":
    "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/world/components/structure-edit-popup.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/features/world/containers/military-modal.tsx": "B (blitz-ux): on ux/migrate-windows, lands with B",
  "ui/design-system/kit/player-name.tsx": "D (rings): the board's realm visit, on ux/hud-area-d's board",
  "ui/features/frontier/board/season-detail.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/frontier/board/season-list.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/frontier/board/season-over-card.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/frontier/board/visit-foot.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/frontier/chest/ruin-chest-moment.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/military/battle/battle-lab/battle-lab.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/military/battle/combat-utils.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/military/components/compact-defense-display.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/military/components/troop-chip.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/social/components/social-board.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/social/faith/wonder-faith-detail-panel.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/social/realtime-chat/ui/realtime-chat-shell.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/world/containers/hud-chat-window.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/world/containers/spectator-standings.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/features/world/hud/action-bubbles.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/shared/components/production-status-badge.tsx": "D (rings): on ux/hud-area-d, lands with D",
  "ui/design-system/kit/chip.tsx":
    "pending orchestrator (proposed B): Research's page, frontier/research/frontier-research",
  "ui/features/frontier/deploy/deploy-view.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/log/today-sheet.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/production/production-sheet.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/research/tree-page.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/rollover/day-done-card.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/rollover/last-hour.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/value/lords-purse.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/value/realms-sheet.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/value/season-withdraw.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/frontier/value/withdraw-sheet.tsx":
    "pending orchestrator (proposed B; deploy-view D): a Frontier page the HUD opens, on no area's list",
  "ui/features/world/containers/compact-hud.tsx": "A, mobile pass: a phone-only facet, left to the owner's mobile pass",
  "ui/features/world/containers/top-header/hud-header-layout.tsx":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass",
  "ui/features/world/containers/left-facets/structure-actions-panel.tsx":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass",
  "ui/features/world/containers/left-facets/structure-list-column.tsx":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass",
  "ui/features/world/containers/left-facets/suggestion-chip.tsx":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass",
  "ui/features/world/containers/left-facets/suggestions-panel.tsx":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass",
  "ui/design-system/atoms/hud-typography.ts":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass (structure-actions-panel's type constants)",
  "ui/design-system/atoms/overlay-surface.ts":
    "A, mobile pass: a phone-only facet, left to the owner's mobile pass (structure-list-column's surface)",
  "ui/features/world/components/bottom-right-panel/hex-minimap.tsx":
    "A, the world map's sheet: the minimap canvas's colours, painted in WebGL, not CSS",
  "ui/design-system/molecules/requirement-chips.tsx":
    "A (hud): REQUIREMENT_CHIP's last use, faith-devotion-action-panel; the export goes when it lands",
  "ui/design-system/atoms/hud-typography.ts": "A (hud): the structure sidebar's type, read by Build and Transfer",
  "ui/features/world/components/structure-status-row/structure-status-row.tsx": "A (hud): the structure sidebar's rows",
  "ui/features/world/containers/left-facets/structure-category-filter.tsx": "A (hud): the structure sidebar's filter",
  "ui/features/world/containers/top-header/structure-groups.ts":
    "A (hud): the group colours Edit structure and the Transfer pickers paint",
  "ui/features/world/components/entities/hooks/use-structure-entity-detail.ts": "A (hud): Military's structure heading",
  "ui/features/military/components/troop-chip.tsx": "D (rings): an army holder's troops in the relic target",
  "ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx":
    "D (rings): the Military window's deploy form",
  "ui/features/military/components/unified-army-creation-modal/existing-armies-panel.tsx":
    "D (rings): the Military window's army list",
  "ui/shared/components/production-status-badge.tsx": "D (rings): the Build and Production badges",
  "ui/features/military/components/army-deployment-picker.tsx":
    "D (rings): the map's deploy picker, built in the deploy layout the owner picks",
};

/**
 * The controls the sheet replaced, by module or folder: the HUD reaches none of them even once they draw the sheet's
 * look. Each names the sheet element that took its place.
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
  "ui/design-system/molecules/circle-button": "HudBubble, HudIconButton",
  "ui/features/world/components/entities/collapsible-bubble": "HudPanel",
};

/**
 * The kit is the shell's: every component in it (sheet, button, chip, store bar, tier chip, season row…) is a control
 * the HUD does not draw, whatever it looks like. Only what the HUD sheet itself is made of passes: its elements, the
 * sheet's close behaviour (no look of its own) and the tooltip's line (the sheet's tip). The kit's .ts helpers (time,
 * words, amounts) draw nothing.
 */
const KIT = "ui/design-system/kit/";
const KIT_FOR_HUD = new Set(["hud-elements.tsx", "sheet-closes.tsx", "named-tips.tsx"]);

/** Whether an app file is a retired control, a retired folder's (the old tabs), or a kit component, whatever it draws now. */
export const isRetired = (path) => {
  if (path.startsWith(KIT)) return path.endsWith(".tsx") && !KIT_FOR_HUD.has(path.slice(KIT.length));
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

  /**
   * The files defining `name` as a value, through `export … from` re-exports: one file, or a whole module for a
   * namespace re-export (`export * as name from`); none when it is only a type.
   */
  const definers = (file, name, seen = new Set()) => {
    if (seen.has(file)) return [];
    seen.add(file);
    const text = source(file);
    if (new RegExp(`export\\s+(?:declare\\s+)?(?:type|interface)\\s+${name}\\b`).test(text)) return [];
    const declares = `export\\s+(?:default\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class|enum)\\s+${name}\\b`;
    if (new RegExp(declares).test(text)) return [file];
    for (const [, names, specifier] of text.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      for (const part of names.split(",").map((each) => each.trim())) {
        if (part.startsWith("type ")) continue;
        const [original, alias] = part.split(/\s+as\s+/);
        if ((alias ?? original) !== name) continue;
        const target = resolveSpecifier(app, file, specifier);
        return target ? orModule(definers(target, original, seen), target) : [];
      }
    }
    for (const [, alias, specifier] of text.matchAll(/export\s*\*\s*as\s+(\w+)\s+from\s*["']([^"']+)["']/g)) {
      const target = alias === name && resolveSpecifier(app, file, specifier);
      if (target) return whole(target);
    }
    if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text)) return [file];
    for (const [, specifier] of text.matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g)) {
      const target = resolveSpecifier(app, file, specifier);
      const found = target ? definers(target, name, seen) : [];
      if (found.length) return found;
    }
    return [];
  };
  const orModule = (found, module) => (found.length ? found : [module]);

  /**
   * A module imported whole (default, namespace, dynamic, side-effect): the file and every value it re-exports, each at
   * the file defining it, so a barrel hides nothing however the caller spells its import.
   */
  const whole = (file, seen = new Set()) => {
    if (seen.has(file)) return [];
    seen.add(file);
    const files = [file];
    const text = source(file);
    for (const [, typeOnly, names, specifier] of text.matchAll(
      /export\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
    )) {
      const target = !typeOnly && resolveSpecifier(app, file, specifier);
      if (!target) continue;
      for (const part of names.split(",").map((each) => each.trim())) {
        if (!part || part.startsWith("type ")) continue;
        files.push(...orModule(definers(target, part.split(/\s+as\s+/)[0]), target));
      }
    }
    for (const [, typeOnly, specifier] of text.matchAll(
      /export\s+(type\s+)?\*\s*(?:as\s+\w+\s*)?from\s*["']([^"']+)["']/g,
    )) {
      const target = !typeOnly && resolveSpecifier(app, file, specifier);
      if (target) files.push(...whole(target, seen));
    }
    return files;
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
        for (const each of whole(target)) edges.add(each);
      for (const part of named ? named[1].split(",").map((each) => each.trim()) : []) {
        if (!part || part.startsWith("type ")) continue;
        for (const each of definers(target, part.split(/\s+as\s+/)[0])) edges.add(each);
      }
    }
    for (const [, dynamic, bare] of source(file).matchAll(
      /import\(\s*["']([^"']+)["']\s*\)|^import\s+["']([^"']+)["']/gm,
    )) {
      const target = resolveSpecifier(app, file, dynamic ?? bare);
      if (target) for (const each of whole(target)) edges.add(each);
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
