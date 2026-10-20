// The imperative name readers' boundary: no client module reaches getPlayerDisplayName or readPlayerName but the few
// consumers that cache nothing they read. React code reads names through usePlayerNames(), whose reader changes on
// every name revision. A shared line reads it when Share is pressed, and a cache that holds a name takes the reader
// as a value React's own exhaustive-deps sees. The boundary is decided by resolving each import to its file (the @/
// alias or a relative path), never by the spelling of the import. lint-guards.mjs runs it in CI;
// src/name-guards.test.mjs holds its negative controls.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
/** The module that owns the imperative readers, as a resolved file without its extension. */
const READER_MODULE = resolve(SRC, "services/identity/player-profiles");
const IMPERATIVE = new Set(["getPlayerDisplayName", "readPlayerName"]);

/** The file an import names, as the app's resolver finds it: the @/ alias (tsconfig `@/*`) or a relative path. */
const resolveImport = (importer, source) => {
  const base = source.startsWith("@/")
    ? resolve(SRC, source.slice(2))
    : source.startsWith(".")
      ? resolve(dirname(importer), source)
      : null;
  return base?.replace(/\.(tsx?|jsx?|mjs)$/, "").replace(/\/index$/, "") ?? null;
};

/** The name a specifier takes from the module: `x` in `import { x as y }` and in `export { x as y } from`. */
const takenName = (specifier) => {
  const taken = specifier.type === "ImportSpecifier" ? specifier.imported : specifier.local;
  return taken?.type === "Identifier" ? taken.name : taken?.value;
};

/** A module path written as a plain string or a backtick string with nothing interpolated; null when built at run time. */
const staticPath = (source) => {
  if (source.type === "Literal" && typeof source.value === "string") return source.value;
  if (source.type === "TemplateLiteral" && source.expressions.length === 0) return source.quasis[0].value.cooked;
  return null;
};

/** An import, a re-export or a dynamic import of the readers' module that can reach an imperative reader. */
const noImperativeNames = {
  meta: { type: "problem", schema: [] },
  create: (context) => {
    const reaches = (source) => typeof source === "string" && resolveImport(context.filename, source) === READER_MODULE;
    const report = (node) =>
      context.report({
        node,
        message:
          "Only the imperative consumers in name-guards.mjs read a name imperatively: React code reads it through " +
          "usePlayerNames() (or usePlayerName), which follows names that land.",
      });
    return {
      "ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration"(node) {
        if (!node.source || !reaches(node.source.value)) return;
        const specifiers = node.specifiers ?? [];
        const reads =
          node.type === "ExportAllDeclaration" ||
          specifiers.some(
            (specifier) => specifier.type === "ImportNamespaceSpecifier" || IMPERATIVE.has(takenName(specifier)),
          );
        if (reads) report(node);
      },
      // A dynamic import hands over the whole module. Its path is read as a plain or backtick string; one built at
      // run time cannot be resolved here, so it is refused outside the imperative consumers.
      ImportExpression(node) {
        const path = staticPath(node.source);
        if (path === null) {
          context.report({
            node,
            message:
              "A dynamic import here must name its module as a fixed string, so the name readers' boundary can resolve it.",
          });
          return;
        }
        if (reaches(path)) report(node);
      },
    };
  },
};

/**
 * The modules that may read a name imperatively, because nothing caches what they read: the hooks module, which turns
 * the readers into the hooks; the scenes, which redraw labels through watchPlayerNames; the game client's core wiring,
 * which hands the rule to core as its resolver; the fact views; and the name service itself.
 */
const IMPERATIVE_CONSUMERS = [
  "apps/game/src/hooks/use-player-profile.ts",
  "apps/game/src/three/**",
  "apps/game/src/services/game-client.ts",
  "apps/game/src/sync/fact-views.ts",
  "apps/game/src/services/identity/**",
];

/** The boundary as a flat-config block, for lint-guards.mjs and the test alike: every client module but the consumers. */
export const nameGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", ...IMPERATIVE_CONSUMERS],
    plugins: { names: { rules: { "no-imperative-names": noImperativeNames } } },
    rules: { "names/no-imperative-names": "error" },
  },
];
