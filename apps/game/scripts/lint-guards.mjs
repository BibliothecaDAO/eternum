// The lint guards: the rules CI holds the client and its packages to, each closing a class of bug a review found.
// The repo's full ESLint config is not run in CI, so a rule that must hold lives here.
//   node scripts/lint-guards.mjs      fails, naming each hit (CI: pnpm --dir apps/game lint:guards)
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCES = ["apps/game/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"];

// An entity id is its home's namespace times 2^32 plus a serial; a bitwise operator or Math.imul keeps only the low 32
// bits, so every home's Nth army hashed alike (one name for every player's second army). foldEntityId keeps both.
const ID = "/(^id|Id|ID)$/";
const ID_OPERAND = `:matches(Identifier[name=${ID}], MemberExpression[property.name=${ID}])`;
const NO_BITWISE_ID = [
  {
    selector: `BinaryExpression[operator=/^(\\^|\\||&|<<|>>|>>>)$/] > ${ID_OPERAND}`,
    message: "A bitwise operator drops an entity id's home (its high 32 bits): hash foldEntityId(id) instead.",
  },
  {
    selector: `CallExpression[callee.object.name='Math'][callee.property.name='imul'] > ${ID_OPERAND}`,
    message: "Math.imul drops an entity id's home (its high 32 bits): hash foldEntityId(id) instead.",
  },
];

// A function or an object written into text prints its source or "[object Object]": each resource chip's buttons read
// "Transfer (id) => {…}" where a words function was written in place of the word it returns. Typed, so client only.
const TEXT_VALUES = {
  "@typescript-eslint/restrict-template-expressions": [
    "error",
    { allowAny: true, allowBoolean: true, allowNever: true, allowNullish: true, allowNumber: true },
  ],
  "@typescript-eslint/restrict-plus-operands": "error",
};

// A hook called after an early return, or in a branch, runs in some renders and not others: when the condition flips
// React throws "Rendered more hooks than during the previous render" and the panel is gone (Transfer's Balances when a
// player's holdings crossed zero). Where the shorter render calls no stateful hook React cannot tell, so the bug waits
// for the first one added above the return; the rule catches both.
const HOOK_ORDER = { "react-hooks/rules-of-hooks": "error" };

// React code reads a player's name only through the hooks (usePlayerNames, usePlayerName, usePlayerDisplayName), whose
// values change when a name lands: an imperative read in a memo or an effect kept "…" after identity answered (the
// story reader, the Faith board, the battle share). The imperative readers are for the scenes and the services.
const REACT_CODE = [
  "apps/game/src/ui/**/*.{ts,tsx}",
  "apps/game/src/hooks/**/*.{ts,tsx}",
  "apps/game/src/shell/**/*.{ts,tsx}",
];
const NO_IMPERATIVE_NAMES = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@/services/identity/player-profiles",
          importNames: ["getPlayerDisplayName", "readPlayerName"],
          message:
            "React code reads a name through usePlayerNames() (or usePlayerName), which follows names that land.",
        },
      ],
    },
  ],
};

const eslint = new ESLint({
  cwd: REPO,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: SOURCES,
      languageOptions: { parser: tseslint.parser },
      linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
      plugins: { "react-hooks": reactHooks },
      rules: { "no-restricted-syntax": ["error", ...NO_BITWISE_ID], ...HOOK_ORDER },
    },
    {
      files: ["apps/game/src/**/*.{ts,tsx}"],
      ignores: ["**/*.test.{ts,tsx}"],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: resolve(REPO, "apps/game") } },
      plugins: { "@typescript-eslint": tseslint.plugin },
      // Read below for the names a hook returns only: the codebase keys many memos by store revisions on purpose.
      rules: { ...TEXT_VALUES, "react-hooks/exhaustive-deps": "warn" },
    },
    {
      files: REACT_CODE,
      // The hooks module is where the imperative readers become the hooks.
      ignores: ["**/*.test.{ts,tsx}", "apps/game/src/hooks/use-player-profile.ts"],
      rules: NO_IMPERATIVE_NAMES,
    },
  ],
});

/** Each name a file holds from a name hook: `const names = usePlayerNames()`, `const { text } = …`, `usePlayerName(…)`. */
const NAME_HOOK = /const\s+(\{[^}]*\}|\w+)\s*=\s*use(?:PlayerNames|PlayerName|PlayerDisplayName)\(/g;
const nameHookValues = (path) =>
  new Set(
    [...readFileSync(path, "utf8").matchAll(NAME_HOOK)].flatMap(([, held]) =>
      held.startsWith("{")
        ? held
            .slice(1, -1)
            .split(",")
            .map((part) => part.split(":").at(-1).trim())
        : [held],
    ),
  );

/**
 * A memo, a callback or an effect that reads a name hook's value without listing it: it keeps the name it first read
 * when the name lands ("Its missing dependency 'names'"). Other missing dependencies are the codebase's own choice.
 */
const missesNames = (result, message) => {
  if (message.ruleId !== "react-hooks/exhaustive-deps" || !/missing dependenc/.test(message.message)) return false;
  const held = nameHookValues(result.filePath);
  return [...message.message.matchAll(/'([\w$]+)/g)].some(([, root]) => held.has(root));
};

const results = await eslint.lintFiles(SOURCES);
const hits = results.flatMap((result) =>
  result.messages
    .filter((message) => message.fatal || message.severity === 2 || missesNames(result, message))
    .map((message) => `${relative(REPO, result.filePath)}:${message.line}:${message.column} ${message.message}`),
);
for (const hit of hits) console.log(hit);
console.log(`lint guards: ${hits.length} hit(s)`);
process.exitCode = hits.length > 0 ? 1 : 0;
