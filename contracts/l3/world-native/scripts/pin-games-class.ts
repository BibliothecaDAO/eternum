import { readFileSync, writeFileSync } from "node:fs";
import { hash } from "starknet";

const artifact = new URL("../target/dev/world_native_Games.contract_class.json", import.meta.url);
const pin = new URL("../games-class.json", import.meta.url);
const built = hash.computeSierraContractClassHash(JSON.parse(readFileSync(artifact, "utf8")));
const pinned = (JSON.parse(readFileSync(pin, "utf8")) as { gamesClassHash: string }).gamesClassHash;
console.log(JSON.stringify({ built, pinned }));
if (process.argv.includes("--write")) writeFileSync(pin, `${JSON.stringify({ gamesClassHash: built }, null, 2)}\n`);
else if (built !== pinned)
  throw new Error(
    `Games class differs: built ${built}, pinned ${pinned}. A running shard keeps its Games class; only a new shard repins it (bun contracts/l3/world-native/scripts/pin-games-class.ts --write).`,
  );
