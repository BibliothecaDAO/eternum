import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A player reads an army or a structure by its name (`getEntityName`, `getArmyName`, `getStructureName`), never by its
 * entity id: "Structure #12884901891" is a storage key. This finds text that builds a kind's name from an id, in a
 * template (`Army #${army.entityId}`) or in JSX (`Structure #{row.entity_id}`). Logs and errors may carry ids. A realm's
 * own number ("Realm #4321") is its name, so realms are not checked.
 */
const KIND_BEFORE_ID = /\b(Structure|Army|Explorer|Entity|Wonder|Camp|Village|Mine|Hyperstructure) #?$/;
const NAMES_AN_ID = /(\bid|Id|_id|ID)\b/;
const DIAGNOSTIC_CALL = /^console\.|(^|\.)(warn|error|debug|info|log)$|Log$/;

/** Names still built from an id, each to be removed; none may be added. */
const KNOWN = ["three/utils/labels/entity-label-view-model.ts"];

const SOURCE_ROOTS = [__dirname, join(__dirname, "../../../packages/core/src")];

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.(d|test)\.tsx?$/.test(name) ? [path] : [];
  });

const isDiagnostic = (node: ts.Node, file: ts.SourceFile): boolean => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isThrowStatement(parent)) return true;
    if (ts.isNewExpression(parent) && /Error$/.test(parent.expression.getText(file))) return true;
    if (ts.isCallExpression(parent) && DIAGNOSTIC_CALL.test(parent.expression.getText(file))) return true;
  }
  return false;
};

/** Each place in a source that names a kind by an id, as `file:line`. */
const idNames = (path: string, root: string, text = readFileSync(path, "utf8")): string[] => {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const report = (text: string, expression: ts.Node | undefined, at: ts.Node) => {
    if (!expression || !KIND_BEFORE_ID.test(text) || !NAMES_AN_ID.test(expression.getText(file))) return;
    if (isDiagnostic(at, file)) return;
    found.push(`${relative(root, path)}:${file.getLineAndCharacterOfPosition(at.getStart()).line + 1}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node)) {
      report(node.head.text, node.templateSpans[0]?.expression, node);
      node.templateSpans.forEach((span, index) =>
        report(span.literal.text, node.templateSpans[index + 1]?.expression, node),
      );
    }
    if (ts.isJsxElement(node)) {
      node.children.forEach((child, index) => {
        const next = node.children[index + 1];
        if (ts.isJsxText(child) && next && ts.isJsxExpression(next)) report(child.text, next.expression, next);
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

describe("entity names", () => {
  it("are never built from an entity id", () => {
    const found = SOURCE_ROOTS.flatMap((root) => sources(root).flatMap((path) => idNames(path, root)));
    expect(found.filter((place) => !KNOWN.some((known) => place.startsWith(known))).toSorted()).toEqual([]);
  });

  it("are caught in a template or JSX, and logs may still carry ids", () => {
    const source = [
      "const a = `Army #${army.entityId}`;",
      "const b = <p>Structure #{row.entity_id.toString()}</p>;",
      "const c = `Structure ${structure.id} · ${slot}`;",
      "console.warn(`Army ${selectedEntityId} is gone`);",
      "throw new Error(`Structure ${structureId} has no owner`);",
      "const d = `Debug Army ${index + 1}`;",
      "const e = `Realm #${realmId}`;",
    ].join("\n");
    expect(idNames(join(__dirname, "row.tsx"), __dirname, source)).toEqual(["row.tsx:1", "row.tsx:2", "row.tsx:3"]);
  });
});
