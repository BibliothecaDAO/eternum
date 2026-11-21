import { factWireTypes } from "../schema/fact-models.mjs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

// This check replaces unverified fact-only declarations. Generation never reads test artifacts.
async function currentTestTypes(directory) {
  const indexes = (await readdir(directory)).filter((name) => name.endsWith(".test.starknet_artifacts.json")).sort();
  const types = new Map();
  for (const name of indexes) {
    const index = JSON.parse(await readFile(new URL(name, directory), "utf8"));
    for (const contract of index.contracts) {
      const { abi } = JSON.parse(await readFile(new URL(contract.artifacts.sierra, directory), "utf8"));
      for (const type of abi) {
        if (type.type !== "struct" && type.type !== "enum") continue;
        const previous = types.get(type.name);
        if (previous && !isDeepStrictEqual(previous, type)) throw new Error(`Conflicting test ABI type ${type.name}`);
        types.set(type.name, type);
      }
    }
  }
  return types;
}

export async function declaredByWorld(sources, name) {
  const [crate, ...modules] = name.split("::");
  const type = modules.pop();
  if (crate !== "world_native") return true;
  const declaration = new RegExp(`pub (?:struct|enum) ${type}\\b`);
  for (let depth = modules.length; depth > 0; depth -= 1) {
    const file = new URL(`${modules.slice(0, depth).join("/")}.cairo`, sources);
    const source = await readFile(file, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    if (declaration.test(source)) return true;
  }
  return false;
}

export async function checkFactWire(directory, declarations) {
  const types = await currentTestTypes(directory);
  for (const declared of declarations) {
    const compiled = types.get(declared.name);
    if (!compiled) throw new Error(`Missing test ABI coverage for ${declared.name}`);
    if (!isDeepStrictEqual(compiled, declared)) throw new Error(`Fact wire drift for ${declared.name}`);
  }
  return declarations.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = new URL("../src/", import.meta.url);
  const declared = [];
  for (const type of factWireTypes) if (await declaredByWorld(sources, type.name)) declared.push(type);
  const count = await checkFactWire(new URL("../tests/target/dev/", import.meta.url), declared);
  console.log(
    `Verified all ${count} world-declared fact wire types against the test contract ABI (field order and types); ${factWireTypes.length - count} are Herald's own rows`,
  );
}
