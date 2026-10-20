// The name guards: React code reads a player's name only through the name hooks, and a cache that reads one follows
// it. An imperative read in a memo or an effect kept "…" after identity answered (the story reader, the Faith board,
// the battle share), and a guard that matched one spelling let it back in (a typed binding, a relative import). Both
// rules read syntax and scope, never a spelling. lint-guards.mjs runs them in CI; src/name-guards.test.mjs holds
// their negative controls.

/** The module that owns the imperative readers, by any import spelling: the alias, a relative path, an extension. */
const READER_MODULE = /(^|\/)services\/identity\/player-profiles(\.tsx?)?$/;
const IMPERATIVE = new Set(["getPlayerDisplayName", "readPlayerName"]);

/** The hooks module, by any import spelling, and the hooks whose values are names. */
const HOOKS_MODULE = /(^|\/)hooks\/use-player-profile(\.tsx?)?$/;
const NAME_HOOKS = new Set(["usePlayerNames", "usePlayerName", "usePlayerDisplayName"]);

/** React's caches, which keep what their callback read until a listed dependency changes. */
const CACHES = new Set(["useMemo", "useCallback", "useEffect", "useLayoutEffect"]);

const importedName = (specifier) =>
  specifier.type === "ImportSpecifier"
    ? specifier.imported.type === "Identifier"
      ? specifier.imported.name
      : specifier.imported.value
    : null;

/** No React code imports an imperative name reader: not by name, and not through the whole module. */
const noImperativeNames = {
  meta: { type: "problem", schema: [] },
  create: (context) => ({
    "ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration"(node) {
      if (!node.source || !READER_MODULE.test(String(node.source.value))) return;
      const specifiers = node.specifiers ?? [];
      const reads =
        node.type === "ExportAllDeclaration" ||
        specifiers.some(
          (specifier) =>
            specifier.type === "ImportNamespaceSpecifier" ||
            IMPERATIVE.has(importedName(specifier) ?? specifier.local?.name),
        );
      if (reads)
        context.report({
          node,
          message:
            "React code reads a player's name through usePlayerNames() (or usePlayerName), which follows names that " +
            "land; getPlayerDisplayName and readPlayerName are for the imperative consumers in name-guards.mjs.",
        });
    },
  }),
};

/** The variable an identifier refers to, from the scope it is read in outward. */
const resolve = (scope, name) => {
  for (let at = scope; at; at = at.upper) {
    const variable = at.set.get(name);
    if (variable) return variable;
  }
  return null;
};

/** Whether a call is a name hook's: imported from the hooks module under any local name, or the module's own. */
const isNameHookCall = (call, scope) => {
  if (call?.type !== "CallExpression" || call.callee.type !== "Identifier") return false;
  const variable = resolve(scope, call.callee.name);
  const def = variable?.defs[0];
  if (!def) return false;
  if (def.type === "ImportBinding")
    return HOOKS_MODULE.test(String(def.parent.source.value)) && NAME_HOOKS.has(importedName(def.node));
  return def.type === "FunctionName" || def.type === "Variable" ? NAME_HOOKS.has(variable.name) : false;
};

/** The identifier an expression is rooted at: `names` in `names.text` or `names.text(a)`. */
const rootIdentifier = (node) => {
  let at = node;
  while (at && (at.type === "MemberExpression" || at.type === "TSNonNullExpression" || at.type === "ChainExpression"))
    at = at.type === "MemberExpression" ? at.object : at.expression;
  return at?.type === "Identifier" ? at : null;
};

/** Whether a function reads a name: any variable it closes over holds one. */
const readsNames = (fn, sourceCode, seen) =>
  sourceCode.getScope(fn).through.some((reference) => holdsNames(reference.resolved, sourceCode, seen));

/**
 * Whether a variable holds a name, the name reader, or a function that reads one: bound from a name hook's call,
 * however its declaration is written (a type annotation, destructuring); from another such variable
 * (`const text = names.text`); or a local function that closes over one (`const line = (a) => names.text(a)`).
 */
const holdsNames = (variable, sourceCode, seen = new Set()) => {
  if (!variable || seen.has(variable)) return false;
  seen.add(variable);
  return variable.defs.some((def) => {
    if (def.type === "FunctionName") return readsNames(def.node, sourceCode, seen);
    if (def.type !== "Variable" || !def.node.init) return false;
    let init = def.node.init;
    while (
      init.type === "TSAsExpression" ||
      init.type === "TSSatisfiesExpression" ||
      init.type === "TSNonNullExpression"
    )
      init = init.expression;
    if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
      return readsNames(init, sourceCode, seen);
    const scope = sourceCode.getScope(def.node);
    if (isNameHookCall(init, scope)) return true;
    const root = rootIdentifier(init);
    return root ? holdsNames(resolve(scope, root.name), sourceCode, seen) : false;
  });
};

/** A memo, a callback or an effect that reads a name lists what it read it from, so it reads again when one lands. */
const cachedNamesFollow = {
  meta: { type: "problem", schema: [] },
  create: (context) => {
    const sourceCode = context.sourceCode;
    return {
      CallExpression(call) {
        const callee =
          call.callee.type === "MemberExpression" && call.callee.property.type === "Identifier"
            ? call.callee.property.name
            : call.callee.type === "Identifier"
              ? call.callee.name
              : null;
        const [callback, deps] = call.arguments;
        if (!CACHES.has(callee) || !deps || deps.type !== "ArrayExpression") return;
        if (callback?.type !== "ArrowFunctionExpression" && callback?.type !== "FunctionExpression") return;
        const outer = sourceCode.getScope(call);
        const listed = new Set(
          deps.elements.map((element) => {
            const root = element && rootIdentifier(element.type === "SpreadElement" ? element.argument : element);
            return root ? resolve(outer, root.name) : null;
          }),
        );
        const reported = new Set();
        const visit = (scope) => {
          for (const reference of scope.through) {
            const variable = reference.resolved;
            if (!variable || listed.has(variable) || reported.has(variable)) continue;
            if (!holdsNames(variable, sourceCode)) continue;
            reported.add(variable);
            context.report({
              node: deps,
              message: `'${variable.name}' reads a player's name: list it in the dependencies, so the cache reads again when a name lands.`,
            });
          }
        };
        visit(sourceCode.getScope(callback));
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

const namesPlugin = { rules: { "no-imperative-names": noImperativeNames, "cached-names-follow": cachedNamesFollow } };

/**
 * The two guards as flat-config blocks, for lint-guards.mjs and the test alike: every cache in the client follows the
 * names it reads; and no module imports an imperative reader but the imperative consumers below. The boundary is an
 * allowlist, so a new folder, or a service a screen calls, is held to it by default.
 */
export const nameGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    plugins: { names: namesPlugin },
    rules: { "names/cached-names-follow": "error" },
  },
  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", ...IMPERATIVE_CONSUMERS],
    plugins: { names: namesPlugin },
    rules: { "names/no-imperative-names": "error" },
  },
];
