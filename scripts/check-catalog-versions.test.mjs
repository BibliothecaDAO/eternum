import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultCatalogOf, findOffCatalogVersions } from "./check-catalog-versions.mjs";

const manifest = (path, fields) => ({ path, text: JSON.stringify({ name: path, ...fields }) });

test("the default catalog's names are read; a named catalog's are not", () => {
  const workspace = [
    "packages:",
    "  - apps/*",
    "",
    "# One version for every package that uses it.",
    "catalog:",
    "  effect: 4.1.1",
    '  "@scope/tool": ^2.0.0',
    "",
    "catalogs:",
    "  web:",
    "    react: ^19",
  ].join("\n");
  assert.deepEqual(defaultCatalogOf(workspace), ["effect", "@scope/tool"]);
});

test("a hand-pinned catalog dependency is found in any dependency field; catalog specs and other names are not", () => {
  const findings = findOffCatalogVersions(
    ["effect", "@scope/tool"],
    [
      manifest("apps/a/package.json", { dependencies: { effect: "4.0.4", react: "^18" } }),
      manifest("apps/b/package.json", { devDependencies: { "@scope/tool": "^1.0.0" } }),
      manifest("apps/c/package.json", { peerDependencies: { effect: "catalog:web" } }),
      manifest("apps/d/package.json", { dependencies: { effect: "catalog:" } }),
      manifest("apps/e/package.json", { optionalDependencies: { effect: "catalog:default" } }),
      manifest("apps/f/package.json", { dependencies: { vitest: "^3.2.4" } }),
    ],
  );
  assert.deepEqual(findings, [
    { path: "apps/a/package.json", name: "effect", spec: "4.0.4" },
    { path: "apps/b/package.json", name: "@scope/tool", spec: "^1.0.0" },
    { path: "apps/c/package.json", name: "effect", spec: "catalog:web" },
  ]);
});
