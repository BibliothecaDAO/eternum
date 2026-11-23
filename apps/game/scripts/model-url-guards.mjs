import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THREE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/three");
const RAW_MODEL_PATH = /^\/models(?:\/|$)/;
const MODEL_IDENTIFIER = /(?:MANIFEST|MODEL)_PATH$/;
const RAW_PATH_MESSAGE =
  "Model paths come from modelPath(...) in @/three/utils/model-url, never a raw '/models/...' string.";
const BARE_FETCH_MESSAGE =
  "Fetch model files and manifests through fetchModel(...) in @/three/utils/model-url so deployed content-hashed URLs resolve.";

const isUnderThree = (filename) => {
  const rel = relative(THREE_ROOT, filename);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith("/");
};

const isBareModelFetchTarget = (node) => {
  if (!node) return false;
  if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
    return node.callee.name === "modelPath" || node.callee.name === "modelUrl";
  }
  if (node.type === "Identifier") return MODEL_IDENTIFIER.test(node.name);
  return false;
};

const modelUrlRule = {
  meta: { type: "problem", schema: [] },
  create: (context) => ({
    Literal(node) {
      if (typeof node.value === "string" && RAW_MODEL_PATH.test(node.value)) {
        context.report({ node, message: RAW_PATH_MESSAGE });
      }
    },
    TemplateElement(node) {
      const text = node.value.cooked ?? "";
      if (node.parent.quasis[0] === node && RAW_MODEL_PATH.test(text)) {
        context.report({ node: node.parent, message: RAW_PATH_MESSAGE });
      }
    },
    CallExpression(node) {
      if (node.callee?.type !== "Identifier" || node.callee.name !== "fetch") return;
      if (isUnderThree(context.filename) || isBareModelFetchTarget(node.arguments[0])) {
        context.report({ node, message: BARE_FETCH_MESSAGE });
      }
    },
  }),
};

export const modelUrlGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["apps/game/src/three/utils/model-url.ts", "**/*.test.{ts,tsx}"],
    plugins: { "model-url": { rules: { "one-builder": modelUrlRule } } },
    rules: { "model-url/one-builder": "error" },
  },
];
