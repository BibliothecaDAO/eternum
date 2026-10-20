#!/usr/bin/env node
/**
 * The Realms X account is written in packages/chain/src/community.ts alone. The game client, realms.world and the docs
 * read it from there, so changing it there changes every surface. This check fails any link to the account, or tag of
 * it, written anywhere else in their sources: the current handle or a retired one, in any case. Links to a single post
 * (`/status/`) and other accounts pass. Run from the repository root; prints JSON, exits 1 on a violation.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CANONICAL = "packages/chain/src/community.ts";
const SCOPES = ["apps/game/src/", "apps/web/src/", "apps/game-docs/docs/"];
const SOURCE = /\.(ts|tsx|js|jsx|mjs|md|mdx)$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;

/** Another game's own listing that happens to be the Realms account: it follows that game, not Realms. */
const ALLOWED = [
  {
    path: "apps/web/src/site/data/games.ts",
    line: 'twitter: "https://twitter.com/LootRealms",',
    reason: "Loot Survivor's own listed account",
  },
];

/** The current and retired handles, as the canonical file writes them. */
const handlesOf = (canonical) => {
  const current = canonical.match(/const REALMS_X_HANDLE = "([^"]+)"/)?.[1];
  const retired = canonical.match(/RETIRED_REALMS_X_HANDLES = \[([^\]]*)\]/)?.[1];
  if (!current || retired === undefined)
    throw new Error(`${CANONICAL} does not name the account and its retired handles`);
  return [current, ...[...retired.matchAll(/"([^"]+)"/g)].map((match) => match[1])];
};

/** A profile link to the handle (not one of its posts), or a tag of it. */
const accountPattern = (handle) => new RegExp(`(?:(?:x|twitter)\\.com/${handle}\\b(?!/status/)|@${handle}\\b)`, "gi");

const isAllowed = (path, line) => ALLOWED.some((allowed) => allowed.path === path && line.trim() === allowed.line);

/** Every line of these files that writes a Realms account, outside the canonical file and the allowed listings. */
const accountWrites = (files, handles) =>
  files.flatMap(({ path, text }) =>
    text
      .split("\n")
      .flatMap((line, index) =>
        isAllowed(path, line)
          ? []
          : handles.flatMap((handle) =>
              [...line.matchAll(accountPattern(handle))].map((match) => ({ path, line: index + 1, written: match[0] })),
            ),
      ),
  );

const sourceFiles = () => {
  const listed = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z", ...SCOPES], { encoding: "utf8" });
  if (listed.status !== 0) throw new Error(listed.stderr || "git ls-files failed");
  return listed.stdout
    .split("\0")
    .filter((path) => SOURCE.test(path) && !TEST.test(path) && existsSync(path))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = accountWrites(sourceFiles(), handlesOf(readFileSync(CANONICAL, "utf8")));
  console.log(JSON.stringify({ violations }, null, 2));
  if (violations.length) {
    console.error(`The Realms X account is written outside ${CANONICAL}; read REALMS_X_URL or REALMS_X_TAG instead.`);
    process.exit(1);
  }
}
