import { readFileSync } from "node:fs";
import ts from "typescript";
import config from "./.knip.json";

// The system-call bridge receives its provider as `any`, so TypeScript cannot
// associate those references with the class. Derive them from its actual calls.
function systemCallProviderMethods(): string[] {
  const callSites = ["./packages/types/src/dojo/create-system-calls.ts", "./apps/game/src/sync/game-sync.ts"];
  const methods = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression;
      if (
        (ts.isIdentifier(target) && target.text === "provider") ||
        (ts.isPropertyAccessExpression(target) && target.name.text === "provider")
      ) {
        methods.add(node.expression.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const callSite of callSites) {
    const path = new URL(callSite, import.meta.url);
    visit(ts.createSourceFile(path.pathname, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true));
  }
  return [...methods];
}

export default {
  ...config,
  workspaces: {
    ...config.workspaces,
    "packages/provider": {
      ...config.workspaces["packages/provider"],
      ignoreMembers: systemCallProviderMethods(),
    },
  },
};
