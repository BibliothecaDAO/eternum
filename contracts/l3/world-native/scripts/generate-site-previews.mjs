import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const sources = ["expeditions", "taxonomy", "resources", "rules", "army_relics"];

/** Compile the pure site formulas. Unrecognized Cairo must fail, never leave a partial preview. */
export function compileSitePreviews(source) {
  const rewards = resourceRewards(source);
  const premium = depthRewardRule(source.expeditions);
  const ruin = ruinStrengthRule(source.army_relics);
  return `// @generated from the site reward and ruin guard formulas in Cairo. Run scripts/generate-site-previews.mjs.
export const RELICS_PER_LAYER = ${ruin.strengths.length};

export function previewRuinGuardBounds(rank: number, depth: number): [number, number] {
  const place = rank - 1 - depth;
  const base = [${ruin.strengths.join(", ")}][place];
  if (base === undefined || place < 0) throw new Error("Relic outside its layer");
  const strength = base * 2 ** depth;
  const spread = strength * ${ruin.spread} / 100;
  return [strength - spread, strength + spread];
}

export function previewSiteReward(category: number, initialGuardCount: bigint, depth: number, band: boolean): { resourceType: number; amount: bigint } | null {
  if (band) return null;
${rewards.map(({ category, resource, operator, operand }) => `  if (category === ${category}) return { resourceType: ${resource}, amount: depthReward(initialGuardCount ${operator} ${operand}n, depth) };`).join("\n")}
  return null;
}

function depthReward(amount: bigint, depth: number): bigint {
  return amount * (${premium.base}n + BigInt(depth)) / ${premium.divisor}n;
}

`;
}

function ruinStrengthRule(source) {
  const body = functionBody(source, "ruin_strength", "rank:u8,depth:u8", "u128");
  const match = body.match(
    /^assert!\(rank>depth&&rank<=depth\+RELICS_PER_LAYER,"relicoutsideitslayer"\);letbase:u128=matchrank-1-depth\{0=>([0-9_]+),1=>([0-9_]+),_=>([0-9_]+),?\};base\*core::num::traits::Pow::pow\(2_u128,depth.into\(\)\)$/,
  );
  if (!match) throw new Error("Unsupported ruin strength rule; update the preview compiler");
  const strengths = match.slice(1).map(positiveInteger);
  if (Number(constant(source, "RELICS_PER_LAYER")) !== strengths.length)
    throw new Error("Ruin strengths must name one size a relic of the layer");
  return { strengths, spread: constant(source, "RUIN_GUARD_SPREAD_PERCENT") };
}

function resourceRewards(source) {
  let body = functionBody(
    source.expeditions,
    "site_reward",
    "category:u8,site:ExpeditionSite,depth:u8,band:bool",
    "Option<crate::resources::ResourceAmount>",
  );
  if (!body.startsWith("ifband{returnNone;}")) throw new Error("Unsupported Band payout rule");
  body = body.slice("ifband{returnNone;}".length);
  const imports = body.match(/^usecrate::resources::\{([A-Z_a-z,]+)\};/);
  if (!imports) throw new Error("Unsupported site_reward imports");
  body = body.slice(imports[0].length);
  if (!body.startsWith("letreward=")) throw new Error("Unsupported site_reward premium");
  body = body.slice("letreward=".length);
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
  if (
    rules.length === 0 ||
    body !== "else{None};reward.map(|reward|ResourceAmount{amount:depth_reward(reward.amount,depth),..reward})"
  )
    throw new Error("Unsupported site_reward fallback or premium");
  if (new Set(rules.map(({ category }) => category)).size !== rules.length)
    throw new Error("Duplicate site reward category");
  return rules;
}

function depthRewardRule(source) {
  const body = functionBody(source, "depth_reward", "amount:u128,depth:u8", "u128");
  const rule = body.match(/^amount\*\(([0-9_]+)\+depth.into\(\)\)\/([0-9_]+)$/);
  if (!rule) throw new Error("Unsupported depth_reward formula");
  return { base: positiveInteger(rule[1]), divisor: positiveInteger(rule[2]) };
}

function functionBody(source, name, parameters, returns) {
  const declaration = source.match(new RegExp(`^(?:pub )?fn ${name}\\([^]*?^}`, "m"))?.[0];
  if (!declaration) throw new Error(`Missing Cairo function ${name}`);
  const header = declaration.slice(0, declaration.indexOf("{")).replace(/\s+/g, "").replace(/,\)/g, ")");
  if (header.replace(/^pub/, "") !== `fn${name}(${parameters})->${returns}`)
    throw new Error(`Unsupported ${name} signature`);
  return declaration
    .slice(declaration.indexOf("{") + 1, -1)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, "");
}

function constant(source, name) {
  const value = source.match(new RegExp(`^(?:pub )?const ${name}: u(?:8|32|128) = ([0-9_]+);$`, "m"))?.[1];
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
