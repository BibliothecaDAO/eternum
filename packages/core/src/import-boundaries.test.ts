import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL(".", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "../package.json"), "utf8"));
const parse = (path: string, source: string) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);

function importedSource(file: string, specifier: string): string | undefined {
  if (specifier === manifest.name) return join(root, "index.ts");
  if (!specifier.startsWith(".")) return undefined;
  const path = resolve(dirname(file), specifier);
  return [path, `${path}.ts`, join(path, "index.ts")].find(
    (candidate) => candidate.endsWith(".ts") && existsSync(candidate),
  );
}

function barrelImports(file: string, source: string): string[] {
  return parse(file, source).statements.flatMap((node) => {
    if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly || !ts.isStringLiteral(node.moduleSpecifier))
      return [];
    const imported = importedSource(file, node.moduleSpecifier.text);
    if (!imported) return [];
    const statements = parse(imported, readFileSync(imported, "utf8")).statements;
    if (!statements.length || !statements.every(ts.isExportDeclaration)) return [];
    return [
      `${relative(root, file)}: import concrete modules instead of the ${node.moduleSpecifier.text} re-export file`,
    ];
  });
}

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

it("internal core modules never evaluate a public re-export file", () => {
  expect(sources(root).flatMap((file) => barrelImports(file, readFileSync(file, "utf8")))).toEqual([]);
});

it("rejects the army import that left troop resource exports uninitialized", () => {
  expect(
    barrelImports(
      join(root, "utils/army.ts"),
      'import { configManager, divideByPrecision, getArmyName, gramToKg, nanogramToKg, getTileAt } from "..";',
    ),
  ).toEqual(["utils/army.ts: import concrete modules instead of the .. re-export file"]);
});
