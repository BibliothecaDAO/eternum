import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Structure categories and tile occupiers are stored numbers. src/taxonomy.cairo names each one once; every other
// layer reads those names, so a copy written by hand can neither miss an id nor drift from it.
const TAXONOMY_FILE = "taxonomy.cairo";
const ID_CONSTANT = /^pub const ([A-Z][A-Z0-9_]*)_(CATEGORY|OCCUPIER): u8 = ([0-9]+);$/gm;
const ID_DEFINITION = /\bconst [A-Z][A-Z0-9_]*_(?:CATEGORY|OCCUPIER)\s*:/g;
// Forms that write or compare a structure category or tile occupier. Zero is the empty value of every packed field,
// not an id, so only non-zero numbers are refused.
const LITERAL_ID_FORMS = [
  /\bbase\.category\s*(?:==|!=|<=|>=|<|>)\s*[1-9]/g,
  /\b(?:occupier|occupied|previous)\.category\s*(?:==|!=|<=|>=|<|>)\s*[1-9]/g,
  /\b(?:StructureBase|TileOccupancy)\s*\{[^}]*\bcategory:\s*[1-9]/g,
  /MapState::occupy\([^;]*?,\s*[1-9][0-9]*(?:_u8)?\s*,\s*(?:true|false)\s*,?\s*\)/g,
];

/** The named ids in src/taxonomy.cairo, each family keyed by its TypeScript member name. */
export function parseTaxonomy(source) {
  const families = { CATEGORY: {}, OCCUPIER: {} };
  for (const [, name, family, value] of source.matchAll(ID_CONSTANT)) {
    const ids = families[family];
    const member = typeScriptMemberName(name);
    if (Object.values(ids).includes(Number(value)))
      throw new Error(`Taxonomy reuses ${family} id ${value} for ${name}`);
    ids[member] = Number(value);
  }
  if (Object.keys(families.CATEGORY).length === 0 || Object.keys(families.OCCUPIER).length === 0)
    throw new Error("Taxonomy defines no structure categories or tile occupiers");
  return { structureCategories: families.CATEGORY, tileOccupiers: families.OCCUPIER };
}

/** REALM_REGULAR_LEVEL_1 becomes RealmRegularLevel1, the enum member every TypeScript reader uses. */
function typeScriptMemberName(cairoName) {
  return cairoName
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join("");
}

/** Every place outside the taxonomy module that defines an id or writes one as a bare number. */
export function findTaxonomyViolations(files) {
  return files.flatMap(({ path, source }) => {
    if (path.endsWith(TAXONOMY_FILE)) return [];
    const forms = [ID_DEFINITION, ...LITERAL_ID_FORMS];
    return forms.flatMap((form) =>
      [...source.matchAll(form)].map((match) => `${path}:${lineOf(source, match.index)}: ${firstLine(match[0])}`),
    );
  });
}

/** Reads the taxonomy and fails when any production source keeps its own copy of an id. */
export async function readCheckedTaxonomy(sourceDirectory) {
  const files = await readProductionSources(sourceDirectory);
  const violations = findTaxonomyViolations(files);
  if (violations.length > 0)
    throw new Error(
      `Structure category and tile occupier ids must be named from ${TAXONOMY_FILE}:\n${violations.join("\n")}`,
    );
  return parseTaxonomy(files.find(({ path }) => path === TAXONOMY_FILE).source);
}

// Tests pin stored numbers on purpose, so only production sources must name their ids.
async function readProductionSources(sourceDirectory) {
  const paths = (await readdir(sourceDirectory, { recursive: true }))
    .filter((path) => path.endsWith(".cairo") && !path.startsWith("tests/") && path !== "tests.cairo")
    .sort();
  return Promise.all(
    paths.map(async (path) => ({ path, source: await readFile(join(sourceDirectory, path), "utf8") })),
  );
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function firstLine(text) {
  return text.split("\n")[0].trim();
}
