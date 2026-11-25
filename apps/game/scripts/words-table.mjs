import { readFileSync } from "node:fs";
import tseslint from "typescript-eslint";

const KIT_WORDS = new URL("../src/ui/design-system/kit/words.ts", import.meta.url);

const bare = (node) =>
  node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression" ? bare(node.expression) : node;

const exportsOf = (source) =>
  new Map(
    tseslint.parser
      .parseForESLint(source)
      .ast.body.flatMap((node) =>
        node.type === "ExportNamedDeclaration" ? (node.declaration?.declarations ?? []) : [],
      )
      .map((declaration) => [declaration.id.name, bare(declaration.init)]),
  );

const propertyOf = (object, key) =>
  object?.type === "ObjectExpression"
    ? bare(
        object.properties.find((entry) => entry.type === "Property" && !entry.computed && entry.key.name === key)
          ?.value,
      )
    : undefined;

const textOf = (node) =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node?.type === "TemplateLiteral" && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : undefined;

export const wordAt = (path, source = readFileSync(KIT_WORDS, "utf8")) => {
  const [name, ...keys] = path.split(".");
  const text = textOf(keys.reduce(propertyOf, exportsOf(source).get(name)));
  if (text === undefined) throw new Error(`No written phrase at ${path} in the words table`);
  return text;
};
