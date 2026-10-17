/**
 * The shell's token guard (`pnpm shell:check`): the shell's code names its sizes, colours, radii, faces and wide screen
 * through the token file (apps/game/src/tokens.ts) and its Tailwind classes, never as one-off values. Each exception
 * still in the code is listed in allowlist.json with its reason and the issue that will remove it; the check also fails
 * on a listed exception that no longer exists, so the list only shrinks.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APP = "apps/game/src";

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

/** Each rule, by the value it refuses and where that value belongs instead. */
export const rules = (fonts) => [
  {
    rule: "arbitrary text size: use a TYPE step (text-caption … text-figure)",
    pattern: /\btext-\[[\d.]+(?:px|rem)\]/g,
  },
  { rule: "raw colour: use a COLORS token (kit-*)", pattern: /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z])(?:rgba?|oklch)\(/g },
  { rule: "arbitrary radius: use a RADII token (rounded-key … rounded-plate)", pattern: /\brounded-\[[^\]]*\]/g },
  { rule: "arbitrary wide screen: use wide:", pattern: /\bmin-\[1800px\]:/g },
  {
    rule: "unknown face: use a FONTS face (font-display, font-ui, font-body) or a Tailwind weight",
    pattern: /(?<![\w-])font-(?:\[[^\]]*\]|[a-z][\w-]*)/g,
    allows: (match) => [...fonts, ...TAILWIND_FONTS].includes(match.slice("font-".length)),
  },
];

/** Every refused value in one file's source, with its line. */
export const findViolations = (source, path, fonts) =>
  source.split("\n").flatMap((text, index) =>
    rules(fonts).flatMap(({ rule, pattern, allows }) =>
      [...text.matchAll(pattern)]
        .map(([match]) => match)
        .filter((match) => !allows?.(match))
        .map((match) => ({ path, line: index + 1, rule, match })),
    ),
  );

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

const filesUnder = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter(isScanned);

const main = () => {
  const fonts = fontsOf(readFileSync(join(ROOT, APP, "tokens.ts"), "utf8"));
  const allowlist = JSON.parse(readFileSync(new URL("./allowlist.json", import.meta.url), "utf8"));
  const violations = SCOPE.flatMap(filesUnder).flatMap((path) =>
    findViolations(readFileSync(join(ROOT, path), "utf8"), path, fonts),
  );
  const { extra, stale } = unlisted(violations, allowlist);
  for (const { path, line, rule, match } of extra) console.error(`${path}:${line} ${match}: ${rule}`);
  for (const { file, match, count } of stale)
    console.error(`${file} ${match}: listed ${count}× in scripts/shell-tokens/allowlist.json but fixed; remove it`);
  if (extra.length || stale.length) process.exit(1);
  console.log(`Shell tokens: ${violations.length} listed exceptions, nothing else.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
