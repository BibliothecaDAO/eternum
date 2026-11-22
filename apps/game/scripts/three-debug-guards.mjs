import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THREE_DEBUG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/three/debug");
const THREE_DEBUG_SPECIFIER = /(?:^|\/)three\/debug(?:\/|$)/;
const MESSAGE =
  "Production modules cannot import three/debug: keep debug renderers and fixtures inside debug or lab modules.";

const literalValue = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
};

const targetsThreeDebug = (specifier, filename) => {
  if (THREE_DEBUG_SPECIFIER.test(specifier)) return true;
  if (!specifier.startsWith(".")) return false;
  const target = resolve(dirname(filename), specifier);
  const rel = relative(THREE_DEBUG_ROOT, target);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
};

const noThreeDebug = {
  meta: { type: "problem", schema: [] },
  create: (context) => {
    const check = (node, source) => {
      const specifier = literalValue(source);
      if (specifier && targetsThreeDebug(specifier, context.filename)) context.report({ node, message: MESSAGE });
    };
    return {
      ImportDeclaration(node) {
        check(node, node.source);
      },
      ExportNamedDeclaration(node) {
        check(node, node.source);
      },
      ExportAllDeclaration(node) {
        check(node, node.source);
      },
      ImportExpression(node) {
        check(node, node.source);
      },
    };
  },
};

export const threeDebugGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: [
      "apps/game/src/three/debug/**",
      "apps/game/src/ui/features/debug/**",
      "apps/game/src/lab/**",
      "**/*.test.{ts,tsx}",
    ],
    plugins: { "three-debug": { rules: { "no-prod-import": noThreeDebug } } },
    rules: { "three-debug/no-prod-import": "error" },
  },
];
