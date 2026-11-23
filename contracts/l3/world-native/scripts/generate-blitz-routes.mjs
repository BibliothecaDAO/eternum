import { readFile } from "node:fs/promises";
import { compileBlitzCommandRoutes } from "./command-routes.mjs";
import { feltLengths } from "./felt-length.mjs";
import { readLogicSlots } from "./rule-constants.mjs";
import { writeCairo } from "./write-cairo.mjs";

const root = new URL("../", import.meta.url);
const logicClasses = await readLogicSlots(root);

async function readBuild(target) {
  const artifacts = Object.fromEntries(
    await Promise.all(
      logicClasses.map(async ({ name, contract }) => {
        const artifact = JSON.parse(
          await readFile(new URL(`${target}/world_native_${contract}.contract_class.json`, root)),
        );
        return [name, artifact.abi];
      }),
    ),
  );
  const types = new Map();
  for (const item of Object.values(artifacts).flat()) {
    if (item.type !== "struct" && item.type !== "enum") continue;
    if (types.has(item.name) && JSON.stringify(types.get(item.name)) !== JSON.stringify(item))
      throw new Error(`Conflicting ABI type ${item.name} in ${target}`);
    types.set(item.name, item);
  }
  return { artifacts, types, feltLength: feltLengths(types) };
}

await writeCairo(
  "src/blitz_command_routes.cairo",
  compileBlitzCommandRoutes(await readBuild("target/dev"), await readBuild("target/blitz/dev"), logicClasses),
);
