import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * An effect whose callback is an arrow with an expression body returns that expression, and React calls whatever an
 * effect returns as its cleanup: `() => ref.current?.scrollIntoView()` hands back a non-function, and Chromium stops
 * the page with "destroy is not a function". Every effect callback here takes a block body, so a cleanup is returned
 * only on purpose.
 */
const EFFECT_HOOKS = /^use(Layout|Insertion)?Effect$/;

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : [];
  });

const hookName = (callee: ts.Expression): string | null => {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
};

/** Each effect in a source whose callback is an arrow with an expression body, as `file:line`. */
const expressionBodiedEffects = (path: string, text = readFileSync(path, "utf8")): string[] => {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && EFFECT_HOOKS.test(hookName(node.expression) ?? "")) {
      const [callback] = node.arguments;
      if (callback && ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) {
        const { line } = file.getLineAndCharacterOfPosition(callback.getStart());
        found.push(`${relative(__dirname, path)}:${line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

describe("effect callbacks", () => {
  it("all take a block body, so none returns a value React would call as its cleanup", () => {
    expect(
      sources(__dirname)
        .flatMap((path) => expressionBodiedEffects(path))
        .toSorted(),
    ).toEqual([]);
  });

  it("are caught when one returns an expression, however it is written", () => {
    const source = [
      "useEffect(() => ref.current?.scrollIntoView({ block: 'nearest' }), [selected]);",
      "React.useLayoutEffect(",
      "  () =>",
      "    measure(),",
      "  [],",
      ");",
      "useEffect(() => {",
      "  ref.current?.scrollIntoView();",
      "}, []);",
    ].join("\n");
    expect(expressionBodiedEffects(join(__dirname, "row.tsx"), source)).toEqual(["row.tsx:1", "row.tsx:3"]);
  });
});
