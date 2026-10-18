/**
 * The retired controls guard, run by `pnpm hud:check`: an area that has moved onto the HUD sheet reaches no retired
 * control (the old atom Button, NumberInput, Checkbox, Select, TextInput, tabs, overlay surface and type constants, the
 * HUD's CircleButton), neither by importing it nor through a shared wrapper that does (a molecule, a shared component).
 * A wrapper an area may still pass through is named in EXCEPTIONS with the area that retires it. A new path fails.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** The finished areas, by the files and folders that are theirs (apps/game/src paths). */
export const CLEAN = {
  "D: Military, rings, leaderboard": [
    "ui/features/military",
    "ui/features/social",
    "ui/features/frontier/board",
    "ui/features/frontier/chest",
    "ui/features/frontier/deploy/deploy-ring.tsx",
    "ui/features/world/containers/spectator-standings.tsx",
    "ui/features/world/components/actions/chest-tile-details.tsx",
    "ui/features/world/hud/action-bubbles.tsx",
    "ui/shared/components/production-status-badge.tsx",
  ],
};

/** The retired controls and looks, by module (apps/game/src paths, no extension). */
const RETIRED = [
  "ui/design-system/atoms/button",
  "ui/design-system/atoms/checkbox",
  "ui/design-system/atoms/number-input",
  "ui/design-system/atoms/select",
  "ui/design-system/atoms/text-input",
  "ui/design-system/atoms/tab",
  "ui/design-system/atoms/overlay-surface",
  "ui/design-system/atoms/hud-typography",
  "ui/design-system/molecules/circle-button",
];

/** Shared wrappers the walk goes through: a finished area must not reach a retired control behind one. */
const THROUGH = ["ui/design-system/", "ui/shared/"];

/** Wrappers a finished area may still pass through, and who retires what they keep. */
const EXCEPTIONS = {
  "ui/design-system/molecules/popover":
    "PopoverPanel keeps OVERLAY_SURFACE_BASE and the old type constants for a child that is not a HudWindow; area F retires them. Area D uses only surfaceAnchorFrom and hosts HudWindows, whose chrome the panel hands over.",
};

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** A module's imports and re-exports, static, side-effect and dynamic, as written. */
export const importsOf = (source) =>
  [
    ...source.matchAll(
      /(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm,
    ),
  ].map((match) => match[1] ?? match[2] ?? match[3]);

/**
 * Every path from a finished area's file to a retired module, over `modules` (a map of module name, without
 * extension, to its import names already resolved to module names). The walk enters only THROUGH wrappers, never the
 * kit, never an exception, and never another area's features.
 */
export const retiredReach = ({ roots, modules, retired = RETIRED, through = THROUGH, exceptions = EXCEPTIONS }) => {
  const found = [];
  for (const root of roots) {
    const seen = new Set();
    const stack = [[root, []]];
    while (stack.length) {
      const [current, path] = stack.pop();
      for (const next of modules.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        if (retired.includes(next)) found.push({ root, path: [...path, next] });
        else if (
          through.some((prefix) => next.startsWith(prefix)) &&
          !next.startsWith("ui/design-system/kit/") &&
          !(next in exceptions)
        )
          stack.push([next, [...path, next]]);
      }
    }
  }
  return found;
};

/** The app's modules under `src`, each with its imports resolved to module names (the `@/` alias and relative). */
export const readModules = (src) => {
  const files = readdirSync(src, { recursive: true })
    .map((name) => join(src, name))
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && statSync(path).isFile());
  const nameOf = (path) =>
    relative(src, path)
      .replace(/\.tsx?$/, "")
      .replace(/\/index$/, "");
  const resolveImport = (from, spec) => {
    const base = spec.startsWith("@/")
      ? join(src, spec.slice(2))
      : spec.startsWith(".")
        ? resolve(dirname(from), spec)
        : null;
    if (base === null) return null;
    const file = EXTENSIONS.map((extension) => base + extension).find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    );
    return file ? nameOf(file) : null;
  };
  return new Map(
    files.map((file) => [
      nameOf(file),
      importsOf(readFileSync(file, "utf8"))
        .map((spec) => resolveImport(file, spec))
        .filter((name) => name !== null),
    ]),
  );
};

/** The finished areas' files, by module name. */
export const rootsOf = (modules, area) =>
  [...modules.keys()].filter((name) =>
    area.some((path) => name === path.replace(/\.tsx?$/, "") || name.startsWith(`${path}/`)),
  );
