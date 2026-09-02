// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `useEntityQuery` over a fragment list without a `HasValue` subscribes a component to every row of a component
 * and re-renders it per row write; under a 96-player workload that is the React commit bus. Aggregate derivation
 * belongs in the RECS → store bridge (`src/sync/recs-store-bridge.ts`), which runs once per ingest slice; components
 * read a slice. A cold, low-cardinality aggregate may stay only with a named reason here.
 */
type AllowedQueryClass = "cold";

interface AllowedAggregateQuery {
  class: AllowedQueryClass;
  reason: string;
}

const ALLOWED_AGGREGATE_QUERIES: Record<string, AllowedAggregateQuery> = {};

const ROOTS = ["apps/game/src", "packages/react/src"];
const REPOSITORY_ROOT = resolve(process.cwd(), "../..");
const QUERY_CALL = /useEntityQuery\(\s*\[([\s\S]*?)\]\s*(?:,[\s\S]*?)?\)/g;

const isSourceFile = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx");

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return isSourceFile(name) ? [path] : [];
  });

// A spread fragment list is composed elsewhere in the same file; it counts as scoped when that file scopes it.
const isAggregate = (fragments: string, source: string): boolean =>
  !fragments.includes("HasValue(") && !(fragments.includes("...") && source.includes("HasValue("));

const aggregateQuerySites = (): string[] =>
  ROOTS.flatMap((root) => walk(resolve(REPOSITORY_ROOT, root)))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return [...source.matchAll(QUERY_CALL)].some(([, fragments]) => isAggregate(fragments, source));
    })
    .map((path) => relative(REPOSITORY_ROOT, path))
    .toSorted();

describe("RECS query discipline", () => {
  it("keeps aggregate entity queries in the bridge, or names the cold ones with a reason", () => {
    const actual = aggregateQuerySites();
    const allowed = Object.keys(ALLOWED_AGGREGATE_QUERIES).toSorted();

    expect(actual, "derive the aggregate in src/sync/recs-store-bridge.ts and read its slice").toEqual(allowed);
  });

  it("never lets the bridge itself subscribe through React", () => {
    const bridge = readFileSync(resolve(process.cwd(), "src/sync/recs-store-bridge.ts"), "utf8");

    expect(bridge).not.toContain("useEntityQuery");
    expect(bridge).toContain("subscribeSliceApplied");
  });
});
