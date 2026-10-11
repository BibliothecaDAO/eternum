import { factWireTypes } from "../schema/fact-models.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

// This check replaces unverified fact-only declarations. Generation never reads test artifacts.
async function currentTestTypes(directory) {
  const index = JSON.parse(
    await readFile(new URL("world_native_unittest.test.starknet_artifacts.json", directory), "utf8"),
  );
  const types = new Map();
  for (const contract of index.contracts) {
    const { abi } = JSON.parse(await readFile(new URL(contract.artifacts.sierra, directory), "utf8"));
    for (const type of abi) {
      if (type.type !== "struct" && type.type !== "enum") continue;
      const previous = types.get(type.name);
      if (previous && !isDeepStrictEqual(previous, type)) throw new Error(`Conflicting test ABI type ${type.name}`);
      types.set(type.name, type);
    }
  }
  return types;
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
  const count = await checkFactWire(new URL("../target/dev/", import.meta.url), factWireTypes);
  console.log(`Verified all ${count} fact wire types against the test-profile ABI (field order and types)`);
}
