import { factWireTypes } from "../schema/fact-models.mjs";
import { readdir, readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

// This check replaces unverified fact-only declarations. Generation never reads test artifacts.
const directory = new URL("../target/dev/", import.meta.url);
const types = new Map();
for (const name of await readdir(directory)) {
  if (!name.endsWith(".test.contract_class.json")) continue;
  const { abi } = JSON.parse(await readFile(new URL(name, directory), "utf8"));
  for (const type of abi) {
    if (type.type !== "struct" && type.type !== "enum") continue;
    const previous = types.get(type.name);
    if (previous && !isDeepStrictEqual(previous, type)) throw new Error(`Conflicting test ABI type ${type.name}`);
    types.set(type.name, type);
  }
}
for (const declared of factWireTypes) {
  const compiled = types.get(declared.name);
  if (!compiled) throw new Error(`Missing test ABI coverage for ${declared.name}`);
  if (!isDeepStrictEqual(compiled, declared)) throw new Error(`Fact wire drift for ${declared.name}`);
}
console.log(
  `Verified all ${factWireTypes.length} fact wire types against the test-profile ABI (field order and types)`,
);
