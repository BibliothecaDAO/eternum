import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const sources = ["expeditions", "progression", "taxonomy", "resources", "rules"];

/** Compile the two pure payout formulas. Unrecognized Cairo must fail, never leave a partial preview. */
export function compileSitePreviews(source) {
  const rewards = resourceRewards(source);
  const xp = clearXpRule(source.progression);
  const precision = constant(source.rules, "RESOURCE_PRECISION");
  return `// From expeditions.cairo::site_reward and progression.cairo::clear_xp. Run scripts/generate-site-previews.mjs.
export function previewSiteReward(category: number, initialGuardCount: bigint): { resourceType: number; amount: bigint } | null {
${rewards.map(({ category, resource, operator, operand }) => `  if (category === ${category}) return { resourceType: ${resource}, amount: initialGuardCount ${operator} ${operand}n };`).join("\n")}
  return null;
}

export function previewSiteClearXp(initialGuardCount: bigint): number {
  const xp = integerSqrt(initialGuardCount / ${precision}n * ${xp.multiplier}n) / ${xp.divisor}n;
  if (xp > 0xffff_ffffn) throw new Error("Site clear XP exceeds u32");
  return Number(xp);
}

/** Cairo's integer square root, without converting a scaled troop count to floating point. */
function integerSqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("Negative site strength");
  let root = value;
  let next = (root + 1n) / 2n;
  while (next < root) {
    root = next;
    next = (root + value / root) / 2n;
  }
  return root;
}
`;
}

function resourceRewards(source) {
  let body = functionBody(
    source.expeditions,
    "site_reward",
    "category:u8,site:ExpeditionSite",
    "Option<crate::resources::ResourceAmount>",
  );
  const imports = body.match(/^usecrate::resources::\{([A-Z_a-z,]+)\};/);
  if (!imports) throw new Error("Unsupported site_reward imports");
  body = body.slice(imports[0].length);
  const names = imports[1].split(",");
  const rules = [];
  while (body.startsWith(rules.length === 0 ? "if" : "elseif")) {
    const branch = body.match(
      /^(?:else)?ifcategory==crate::taxonomy::([A-Z_]+)\{Some\(ResourceAmount\{resource_type:([A-Z_]+),amount:site.initial_guard_count([*/])([0-9_]+),?\}\)\}/,
    );
    if (!branch || !names.includes("ResourceAmount") || !names.includes(branch[2]))
      throw new Error("Unsupported site_reward branch; update the preview compiler");
    const [, category, resource, operator, operand] = branch;
    const factor = positiveInteger(operand);
    rules.push({
      category: constant(source.taxonomy, category),
      resource: constant(source.resources, resource),
      operator,
      operand: factor,
    });
    body = body.slice(branch[0].length);
  }
  if (rules.length === 0 || body !== "else{None}") throw new Error("Unsupported site_reward fallback");
  if (new Set(rules.map(({ category }) => category)).size !== rules.length)
    throw new Error("Duplicate site reward category");
  return rules;
}

function clearXpRule(source) {
  const body = functionBody(source, "clear_xp", "strength:u128", "u32");
  const rule = body.match(
    /^letroot:u64=core::num::traits::Sqrt::sqrt\(strength\/crate::rules::RESOURCE_PRECISION\*([0-9_]+)\);\(root\/([0-9_]+)\).try_into\(\).unwrap\(\)$/,
  );
  if (!rule) throw new Error("Unsupported clear_xp formula; update the preview compiler");
  return { multiplier: positiveInteger(rule[1]), divisor: positiveInteger(rule[2]) };
}

function functionBody(source, name, parameters, returns) {
  const declaration = source.match(new RegExp(`^pub fn ${name}\\([^]*?^}`, "m"))?.[0];
  if (!declaration) throw new Error(`Missing Cairo function ${name}`);
  const header = declaration.slice(0, declaration.indexOf("{")).replace(/\s+/g, "");
  if (header !== `pubfn${name}(${parameters})->${returns}`) throw new Error(`Unsupported ${name} signature`);
  return declaration
    .slice(declaration.indexOf("{") + 1, -1)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, "");
}

function constant(source, name) {
  const value = source.match(new RegExp(`^pub const ${name}: u(?:8|128) = ([0-9_]+);$`, "m"))?.[1];
  if (!value) throw new Error(`Missing Cairo payout constant ${name}`);
  return positiveInteger(value);
}

function positiveInteger(value) {
  const integer = BigInt(value.replaceAll("_", ""));
  if (integer <= 0n) throw new Error("Payout rule requires a positive integer");
  return integer.toString();
}

/** The schema command and the standalone drift check share the same writer. */
export async function generateSitePreviews(check = false) {
  const source = Object.fromEntries(
    await Promise.all(sources.map(async (name) => [name, await readFile(new URL(`src/${name}.cairo`, root), "utf8")])),
  );
  const { format, resolveConfig } = await import("prettier");
  const target = new URL("schema/site-previews.gen.ts", root);
  const output = await format(compileSitePreviews(source), {
    ...(await resolveConfig(fileURLToPath(target))),
    parser: "typescript",
  });
  if (check) {
    if ((await readFile(target, "utf8")) !== output)
      throw new Error(
        "Regenerate site previews from Cairo: node contracts/l3/world-native/scripts/generate-site-previews.mjs",
      );
  } else await writeFile(target, output);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await generateSitePreviews(process.argv.includes("--check"));
