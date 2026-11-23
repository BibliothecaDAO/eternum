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

const isModelExpression = (node, tracked) => {
  if (!node) return false;
  if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
    return node.callee.name === "modelPath" || node.callee.name === "modelUrl";
  }
  if (node.type === "Identifier") return MODEL_IDENTIFIER.test(node.name) || tracked.has(node.name);
  if (node.type === "MemberExpression") return isModelExpression(node.object, tracked);
  if (node.type === "ConditionalExpression") {
    return isModelExpression(node.consequent, tracked) || isModelExpression(node.alternate, tracked);
  }
  if (node.type === "LogicalExpression") {
    return isModelExpression(node.left, tracked) || isModelExpression(node.right, tracked);
  }
  if (node.type === "TSAsExpression" || node.type === "TSNonNullExpression" || node.type === "TSSatisfiesExpression") {
    return isModelExpression(node.expression, tracked);
  }
  if (node.type === "ObjectExpression") {
    return node.properties.some((prop) => prop.type === "Property" && isModelExpression(prop.value, tracked));
  }
  return false;
};

const modelUrlRule = {
  meta: { type: "problem", schema: [] },
  create: (context) => {
    const tracked = new Set();
    const record = (id, init) => {
      if (id?.type === "Identifier" && isModelExpression(init, tracked)) tracked.add(id.name);
    };
    return {
      VariableDeclarator(node) {
        record(node.id, node.init);
      },
      AssignmentExpression(node) {
        record(node.left, node.right);
      },
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
        if (isUnderThree(context.filename) || isModelExpression(node.arguments[0], tracked)) {
          context.report({ node, message: BARE_FETCH_MESSAGE });
        }
      },
    };
  },
};

export const modelUrlGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["apps/game/src/three/utils/model-url.ts", "**/*.test.{ts,tsx}"],
    plugins: { "model-url": { rules: { "one-builder": modelUrlRule } } },
    rules: { "model-url/one-builder": "error" },
  },
];
