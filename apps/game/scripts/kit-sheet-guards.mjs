import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const KIT_DIR = resolve(REPO, "apps/game/src/ui/design-system/kit");

const PREEXISTING_UNOWNED = {
  "hud-sheet.css": new Set([
    "ui-seat",
    "ui-board-own",
    "ui-feed-line",
    "ui-feed-line__glyph",
    "ui-feed-line__reward",
    "ui-popover",
    "ui-workspace",
    "ui-transfer__preview",
    "ui-coin",
    "ui-float",
    "ui-sweep",
    "ui-contours__line",
    "ui-contours__glow",
    "ui-contours__vignette",
    "ui-contours__grid",
  ]),
  "app-sheet.css": new Set([
    "app-frame",
    "app-frame__painting",
    "app-frame__page",
    "app-mark",
    "app-holdings",
    "app-holdings__item",
    "app-well",
    "app-window",
    "app-window__head",
    "app-window__painting",
    "app-window__close",
    "app-window__body",
  ]),
};

export const findUnownedKitSheetClasses = ({
  kitDir = KIT_DIR,
  sheets = [
    { file: "hud-sheet.css", prefix: "ui" },
    { file: "app-sheet.css", prefix: "app" },
  ],
  allowed = PREEXISTING_UNOWNED,
} = {}) => {
  const kitSource = readdirSync(kitDir)
    .filter((name) => /\.(?:ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => readFileSync(join(kitDir, name), "utf8"))
    .join("\n");

  const errors = [];
  for (const { file, prefix } of sheets) {
    const css = readFileSync(join(kitDir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const pattern = new RegExp(`\\.(${prefix}-[a-z0-9_-]+)`, "g");
    const defined = [...new Set([...css.matchAll(pattern)].map((match) => match[1]))];
    const baseline = allowed[file] ?? new Set();
    for (const cls of defined) {
      if (!kitSource.includes(cls) && !baseline.has(cls)) {
        errors.push(
          `${file}: .${cls} is not used by any component in ui/design-system/kit/: move feature layout CSS beside its component or into Tailwind.`,
        );
      }
    }
    for (const cls of baseline) {
      if (!defined.includes(cls) || kitSource.includes(cls)) {
        errors.push(`${file}: baseline entry .${cls} is no longer needed; remove it from PREEXISTING_UNOWNED.`);
      }
    }
  }
  return errors;
};
