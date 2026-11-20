#!/usr/bin/env node
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ROW_BUILDER = "packages/core/src/test-support/game-registry.ts";
export const ROW_ENCODER = "apps/herald/src/native/fixtures.ts";

export const gameRegistryMembers = (schema) => {
  const model = schema.models.find(({ name }) => name === "GameRegistry");
  return [...model.keys, ...model.members].map(({ name }) => name);
};

const propertyName = (property) =>
  (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
  (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
    ? property.name.text
    : undefined;

const BUILDERS = new Set(["gameRegistryRow", "gameRegistryEvent"]);

const isBuilderArgument = (node) =>
  ts.isCallExpression(node.parent) &&
  ts.isIdentifier(node.parent.expression) &&
  BUILDERS.has(node.parent.expression.text);

const isWholeRow = (node, members) =>
  !isBuilderArgument(node) &&
  node.properties.filter((property) => members.includes(propertyName(property))).length >= members.length - 3;

const isRowEventOfGameRegistry = (node) =>
  ts.isIdentifier(node.expression) &&
  node.expression.text === "rowEvent" &&
  node.arguments[0] !== undefined &&
  ts.isStringLiteralLike(node.arguments[0]) &&
  node.arguments[0].text === "GameRegistry";

export function findHandWrittenGameRegistryRows(files, members) {
  return files.flatMap(({ path, text }) => {
    if (path === ROW_BUILDER) return [];
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const findings = [];
    const report = (node, reason) =>
      findings.push({ path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, reason });
    const visit = (node) => {
      if (ts.isObjectLiteralExpression(node) && isWholeRow(node, members))
        report(node, `a GameRegistry row written by hand: build it with gameRegistryRow from ${ROW_BUILDER}`);
      if (ts.isCallExpression(node) && path !== ROW_ENCODER && isRowEventOfGameRegistry(node))
        report(node, `a GameRegistry row event encoded by hand: use gameRegistryEvent from ${ROW_ENCODER}`);
      ts.forEachChild(node, visit);
    };
    visit(source);
    return findings;
  });
}

export const isScannedSource = (path) =>
  /\.(ts|tsx|js|mjs)$/.test(path) && /^(apps|packages|deploy|config)\//.test(path) && !/node_modules\//.test(path);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const schema = JSON.parse(readFileSync("contracts/l3/world-native/schema/schema.json", "utf8"));
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => isScannedSource(path) && existsSync(path));
  const findings = findHandWrittenGameRegistryRows(
    files.map((path) => ({ path, text: readFileSync(path, "utf8") })),
    gameRegistryMembers(schema),
  );
  for (const { path, line, reason } of findings) console.error(`${path}:${line}: ${reason}`);
  if (findings.length > 0) process.exit(1);
  console.log(`every GameRegistry row comes from ${ROW_BUILDER} (${files.length} files)`);
}
