import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * s2 single-world SQL scoping lint (A3-deferred, A4 P4): every reference to a
 * per-game table inside a query template must sit in a template that carries at
 * least one {GF} game-filter marker — otherwise the query reads every game's
 * rows on the shared s2 world. Tables are classified from the s2 manifest's
 * key flags; s1-only tables (no s2 counterpart) are exempt but must only be
 * used from legacy-arm code paths.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../..");

type ManifestEntry = { tag: string; members?: Array<{ name: string; key?: boolean }> };
const manifest = JSON.parse(readFileSync(join(repoRoot, "contracts/game/manifest_appchain_blitz.json"), "utf8")) as {
  models?: ManifestEntry[];
  events?: ManifestEntry[];
};

const gameScopedTables = new Set(
  [...(manifest.models ?? []), ...(manifest.events ?? [])]
    .filter((entry) => (entry.members ?? []).filter((m) => m.key).map((m) => m.name)[0] === "game_id")
    .map((entry) => entry.tag.split("-", 2)[1] ?? entry.tag),
);

// Table references are authored against the legacy namespace and rewritten at
// the buildApiUrl chokepoint. Only FROM/JOIN references count — column refs
// piggyback on their query's filter, and doc comments mention tables freely.
// The escaped-backtick form (FROM \`s1_eternum-X\`) is the dominant authoring
// style — the class must accept the backslash or 31 of 62 refs go unseen.
const TABLE_REF = /(?:FROM|JOIN)\s*[\\\[`"']*s1_eternum-(\w+)/gi;

const sqlFiles = readdirSync(here).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));

// Split a source file into template-literal chunks so each query is judged on
// its own markers rather than the whole file's.
const templateChunks = (source: string): string[] =>
  source
    .replace(/\\`/g, "'")
    .split("`")
    .filter((_, index) => index % 2 === 1);

describe("SQL game-scope lint", () => {
  it("classifies at least the core per-game tables", () => {
    for (const name of ["Structure", "TileOpt", "Resource", "ExplorerTroops", "GameRegistry"]) {
      expect(gameScopedTables.has(name), name).toBe(true);
    }
  });

  for (const file of sqlFiles) {
    it(`${file}: every per-game table reference is game-filtered`, () => {
      const source = readFileSync(join(here, file), "utf8");
      const offenders: string[] = [];

      for (const chunk of templateChunks(source)) {
        // Queries that only ever run on the legacy arm opt out explicitly.
        if (chunk.includes("-- legacy-only")) continue;
        const tables = [...chunk.matchAll(TABLE_REF)]
          .map((match) => match[1])
          .filter((table) => gameScopedTables.has(table));
        if (tables.length === 0) continue;
        // Column references like `s1_eternum-X`.`col` piggyback on the FROM's
        // filter; one marker per template is the required minimum.
        if (!chunk.includes("{GF")) {
          offenders.push(`[${[...new Set(tables)].join(", ")}] in: ${chunk.trim().slice(0, 120)}...`);
        }
      }

      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});
