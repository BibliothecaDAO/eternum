// One source per fact (AGENTS.md): every list, name, icon or number shown to players comes from one source. A list of
// a catalog's members, or a map that holds only some of them, decides which items exist; written outside the catalog's
// own modules it is a copy that misses whatever the game adds (the build order maker's eight goals had no T2 or T3
// building; Frontier's stores were spelled out eight times). The guard refuses, outside the catalog modules:
//   - a list naming two or more members of one catalog: `[StructureType.Realm, StructureType.Village]`;
//   - a map keyed by two or more members of one catalog that is not a whole `Record<Catalog, …>` (which the compiler
//     holds to every member, by an annotation or `satisfies`; an `as` cast holds it to nothing), including
//     `Partial<Record<Catalog, …>>`;
//   - an image path written as a string: artwork is named through the icon modules (IconMeaning).
// Copies that stood when the guard came are counted in catalog-copies-baseline.json, a count per file that may only
// fall: --write-catalog-baseline lowers a count, and writes nothing while any file gains a copy. lint-guards.mjs runs
// it in CI, and src/catalog-guards.test.mjs holds its controls.

import { readFileSync } from "node:fs";
import tseslint from "typescript-eslint";

/** The game's catalogs: the enums of @bibliothecadao/types whose members are game content. */
const CATALOGS = new Set([
  "ResourcesIds",
  "BuildingType",
  "StructureType",
  "TroopType",
  "TroopTier",
  "RealmLevels",
  "GuardSlot",
  "BiomeType",
  "AspectId",
  "OathJob",
]);

/** The member of a catalog an expression names (`StructureType.Realm` names StructureType), else undefined. */
const catalogOf = (node) =>
  node?.type === "MemberExpression" && node.object.type === "Identifier" && CATALOGS.has(node.object.name)
    ? node.object.name
    : undefined;

/** A catalog named two or more times among some expressions, else undefined. */
const repeatedCatalog = (nodes) => {
  const seen = new Set();
  for (const node of nodes) {
    const catalog = catalogOf(node);
    if (catalog && seen.has(catalog)) return catalog;
    if (catalog) seen.add(catalog);
  }
  return undefined;
};

/** The catalog a type names as `Record<Catalog, …>`, else undefined. */
const recordKeyCatalog = (type) => {
  if (type?.type !== "TSTypeReference" || type.typeName.name !== "Record") return undefined;
  const key = (type.typeArguments ?? type.typeParameters)?.params[0];
  return key?.type === "TSTypeReference" && CATALOGS.has(key.typeName.name) ? key.typeName.name : undefined;
};

/** The catalog a type names as `Partial<Record<Catalog, …>>`, else undefined. */
const partialRecordCatalog = (type) =>
  type?.type === "TSTypeReference" && type.typeName.name === "Partial"
    ? recordKeyCatalog((type.typeArguments ?? type.typeParameters)?.params[0])
    : undefined;

/**
 * The type the compiler holds an object literal to: its `satisfies` type or its variable's annotation, through
 * `as const`. An `as` cast is no such type: TypeScript accepts `{ Realm, Village } as Record<StructureType, …>` with
 * Camp missing, so a cast never vouches that a map is whole.
 */
const declaredType = (object) => {
  let node = object;
  while (node.parent?.type === "TSAsExpression" && node.parent.typeAnnotation.typeName?.name === "const") {
    node = node.parent;
  }
  const parent = node.parent;
  if (parent?.type === "TSSatisfiesExpression") return parent.typeAnnotation;
  if (parent?.type === "VariableDeclarator" && parent.init === node) return parent.id.typeAnnotation?.typeAnnotation;
  return undefined;
};

const IMAGE_PATH = /^\/(images|icons|tokens)\//;
const LAYER_CATALOG = new URL("../../../packages/types/src/words/nouns.ts", import.meta.url);
const ORDERS_CATALOG = new URL("../../../packages/types/src/constants/orders.ts", import.meta.url);
const writtenText = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
};
const withoutTypeAssertions = (node) =>
  node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression"
    ? withoutTypeAssertions(node.expression)
    : node;
const tupleElements = (declarations, name) => {
  const tuple = withoutTypeAssertions(declarations.find((each) => each.id.name === name)?.init);
  return tuple?.type === "ArrayExpression" ? tuple.elements : [];
};
const readsLayerName = (node) => node?.type === "MemberExpression" && node.object.name === "LAYER_NAMES";
const writtenNames = (name, elements) => {
  const names = elements.map(writtenText);
  if (names.length === 0 || names.includes(undefined)) {
    throw new Error(`No ${name} tuple of written names in ${LAYER_CATALOG.pathname}`);
  }
  return names;
};
const propertyText = (element, key) => {
  if (element?.type !== "ObjectExpression") return undefined;
  const prop = element.properties.find(
    (entry) => entry.type === "Property" && !entry.computed && entry.key.name === key,
  );
  return writtenText(prop?.value);
};
export const readLayerNames = (source = readFileSync(LAYER_CATALOG, "utf8")) => {
  const declarations = tseslint.parser
    .parseForESLint(source)
    .ast.body.flatMap((node) => node.declaration?.declarations ?? []);
  const eternumNames = tupleElements(declarations, "ETERNUM_MAP_NAMES").filter((node) => !readsLayerName(node));
  return [
    ...writtenNames("LAYER_NAMES", tupleElements(declarations, "LAYER_NAMES")),
    ...writtenNames("ETERNUM_MAP_NAMES", eternumNames),
  ];
};
export const readAspectAndOrderNames = (source = readFileSync(ORDERS_CATALOG, "utf8")) => {
  const declarations = tseslint.parser
    .parseForESLint(source)
    .ast.body.flatMap((node) => node.declaration?.declarations ?? []);
  const aspectNames = tupleElements(declarations, "aspects").map((entry) => propertyText(entry, "name"));
  const orderNames = tupleElements(declarations, "orders").map((entry) => propertyText(entry, "fullOrderName"));
  if (aspectNames.length === 0 || aspectNames.includes(undefined)) {
    throw new Error(`No aspects names in ${ORDERS_CATALOG.pathname}`);
  }
  if (orderNames.length === 0 || orderNames.includes(undefined)) {
    throw new Error(`No orders fullOrderName entries in ${ORDERS_CATALOG.pathname}`);
  }
  return { aspectNames, orderNames };
};
const asPattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LAYER_SPELLING = new RegExp(`\\b(?:${readLayerNames().map(asPattern).join("|")}|Ethereal I{1,3})\\b`);
const namesLayer = (text) => LAYER_SPELLING.test(text.replace(/\bDeep (?:Ocean|[Cc]rystal)/g, ""));
const { aspectNames: ASPECT_NAMES, orderNames: ORDER_NAMES } = readAspectAndOrderNames();
const ASPECT_OR_ORDER_SPELLING = new RegExp(`\\b(?:${[...ASPECT_NAMES, ...ORDER_NAMES].map(asPattern).join("|")})\\b`);
const namesAspectOrOrder = (text) => ASPECT_OR_ORDER_SPELLING.test(text);

const COPY = "copy";
const IMAGE = "image";
const LAYER = "layer";
const ASPECT_OR_ORDER = "aspectOrOrder";

const oneSource = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      [COPY]:
        "One source per fact: a list or partial map of {{catalog}} members is a copy. Read the catalog (or a table in " +
        "its module), or key a whole Record<{{catalog}}, …> the compiler holds to every member: annotated or with " +
        "`satisfies`, never an `as` cast.",
      [IMAGE]: "One source per fact: artwork is named through the icon modules (IconMeaning), never a path.",
      [LAYER]:
        "One source per fact: a layer's name is layerName(depth) from @bibliothecadao/types, never spelled again.",
      [ASPECT_OR_ORDER]:
        "One source per fact: Aspect and Order names come from @bibliothecadao/types (aspectName / catalogOrder), never spelled again.",
    },
  },
  create: (context) => ({
    ArrayExpression(node) {
      const catalog = repeatedCatalog(node.elements);
      if (catalog) context.report({ node, messageId: COPY, data: { catalog } });
    },
    ObjectExpression(node) {
      const keys = node.properties.filter((property) => property.type === "Property" && property.computed);
      const catalog = repeatedCatalog(keys.map((property) => property.key));
      const declared = declaredType(node);
      // A partial record is reported once, at its type.
      if (catalog && recordKeyCatalog(declared) !== catalog && partialRecordCatalog(declared) !== catalog) {
        context.report({ node, messageId: COPY, data: { catalog } });
      }
    },
    TSTypeReference(node) {
      const catalog = partialRecordCatalog(node);
      if (catalog) context.report({ node, messageId: COPY, data: { catalog } });
    },
    Literal(node) {
      if (typeof node.value !== "string") return;
      if (IMAGE_PATH.test(node.value)) context.report({ node, messageId: IMAGE });
      const isDeveloperMessage = node.parent.type === "NewExpression" && node.parent.callee.name === "Error";
      if (!isDeveloperMessage && namesLayer(node.value)) context.report({ node, messageId: LAYER });
      if (!isDeveloperMessage && namesAspectOrOrder(node.value)) context.report({ node, messageId: ASPECT_OR_ORDER });
    },
    JSXText(node) {
      if (namesLayer(node.value)) context.report({ node, messageId: LAYER });
      if (namesAspectOrOrder(node.value)) context.report({ node, messageId: ASPECT_OR_ORDER });
    },
    TemplateElement(node) {
      const text = node.value.cooked ?? "";
      if (node.parent.quasis[0] === node && IMAGE_PATH.test(text))
        context.report({ node: node.parent, messageId: IMAGE });
      if (namesLayer(text)) context.report({ node: node.parent, messageId: LAYER });
      if (namesAspectOrOrder(text)) context.report({ node: node.parent, messageId: ASPECT_OR_ORDER });
    },
  }),
};

/**
 * Where a catalog's lists and tables belong: the catalogs themselves, the names and icon modules that present them,
 * the config that holds the game's rules per member, and the scenes' asset tables (a model or a painting per member).
 */
const CATALOG_MODULES = [
  "packages/types/src/constants/**",
  "packages/types/src/types/common.ts",
  "packages/types/src/words/**",
  "packages/core/src/managers/config-manager.ts",
  "apps/game/src/ui/design-system/icon-meaning.ts",
  "apps/game/src/ui/design-system/domain-icon-meaning.ts",
  "apps/game/src/three/constants/**",
];

/** Data written for one scenario, not a copy of a catalog: tests, labs and fixtures. */
const SCENARIOS = [
  "**/*.test.{ts,tsx}",
  "**/*fixture*.{ts,tsx}",
  "apps/game/src/lab/**",
  "apps/game/src/ui/features/debug/**",
  "apps/game/src/three/debug/**",
  "apps/game/src/three/**/verification/**",
];

const RECORDS = ["apps/game/src/shell/generated/patch-notes.ts"];

export const CATALOG_RULE = "catalog/one-source";

/**
 * The guard's verdict on the copies standing against the baseline's count per file. A file over its count, or one the
 * baseline does not name, is an addition: refused. A file under its count is a removal. `write` is the lowered
 * baseline --write-catalog-baseline may write: only when it is asked to, something was removed and nothing was added,
 * so lowering the baseline can never carry a new copy in with it.
 */
export const planCatalogBaseline = (counts, baseline, { lowering = false } = {}) => {
  const files = [...new Set([...Object.keys(counts), ...Object.keys(baseline)])].sort();
  const additions = files.filter((file) => (counts[file] ?? 0) > (baseline[file] ?? 0));
  const removals = files.filter((file) => (counts[file] ?? 0) < (baseline[file] ?? 0));
  const write =
    lowering && additions.length === 0 && removals.length > 0
      ? Object.fromEntries(files.map((file) => [file, counts[file] ?? 0]).filter(([, count]) => count > 0))
      : undefined;
  // A removal still asks for the baseline to be lowered unless this run lowers it.
  const unlowered = write ? [] : removals;
  return { additions, unlowered, write };
};

/** The guard as a flat-config block, for lint-guards.mjs and the test alike. */
export const catalogGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    ignores: [...CATALOG_MODULES, ...SCENARIOS, ...RECORDS],
    plugins: { catalog: { rules: { "one-source": oneSource } } },
    rules: { [CATALOG_RULE]: "error" },
  },
];
