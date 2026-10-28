// One source per fact (AGENTS.md): every list, name, icon or number shown to players comes from one source. A list of
// a catalog's members, or a map that holds only some of them, decides which items exist; written outside the catalog's
// own modules it is a copy that misses whatever the game adds (the build order maker's eight goals had no T2 or T3
// building; Frontier's stores were spelled out eight times). The guard refuses, outside the catalog modules:
//   - a list naming two or more members of one catalog: `[StructureType.Realm, StructureType.Village]`;
//   - a map keyed by two or more members of one catalog that is not a whole `Record<Catalog, …>` (which the compiler
//     holds to every member), including `Partial<Record<Catalog, …>>`;
//   - an image path written as a string: artwork is named through the icon modules (IconMeaning).
// Copies that stood when the guard came are counted in catalog-copies-baseline.json, a count per file that may only
// fall; lint-guards.mjs runs it in CI, and src/catalog-guards.test.mjs holds its controls.

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

/** The type an object literal is held to: its `satisfies` or `as` type, or its variable's annotation, through `as const`. */
const declaredType = (object) => {
  let node = object;
  while (node.parent?.type === "TSAsExpression" && node.parent.typeAnnotation.typeName?.name === "const") {
    node = node.parent;
  }
  const parent = node.parent;
  if (parent?.type === "TSSatisfiesExpression" || parent?.type === "TSAsExpression") return parent.typeAnnotation;
  if (parent?.type === "VariableDeclarator") return parent.id.typeAnnotation?.typeAnnotation;
  return undefined;
};

const IMAGE_PATH = /^\/(images|icons|tokens)\//;

const COPY = "copy";
const IMAGE = "image";

const oneSource = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      [COPY]:
        "One source per fact: a list or partial map of {{catalog}} members is a copy. Read the catalog (or a table in " +
        "its module), or key a whole Record<{{catalog}}, …> the compiler holds to every member.",
      [IMAGE]: "One source per fact: artwork is named through the icon modules (IconMeaning), never a path.",
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
      if (typeof node.value === "string" && IMAGE_PATH.test(node.value)) context.report({ node, messageId: IMAGE });
    },
    TemplateElement(node) {
      if (node.parent.quasis[0] === node && IMAGE_PATH.test(node.value.cooked ?? "")) {
        context.report({ node: node.parent, messageId: IMAGE });
      }
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

export const CATALOG_RULE = "catalog/one-source";

/** The guard as a flat-config block, for lint-guards.mjs and the test alike. */
export const catalogGuardConfigs = [
  {
    files: ["apps/game/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    ignores: [...CATALOG_MODULES, ...SCENARIOS],
    plugins: { catalog: { rules: { "one-source": oneSource } } },
    rules: { [CATALOG_RULE]: "error" },
  },
];
