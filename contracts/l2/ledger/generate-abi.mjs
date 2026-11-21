import { mkdir, readFile, writeFile } from "node:fs/promises";

const ledger = new URL("./", import.meta.url);
const GENERATED = { GameLedger: "schema/abi.json", RaceRewards: "schema/race-abi.json" };
const check = process.argv.includes("--check");

for (const [contract, path] of Object.entries(GENERATED)) {
  const artifact = JSON.parse(
    await readFile(new URL(`target/dev/game_ledger_${contract}.contract_class.json`, ledger)),
  );
  if (!Array.isArray(artifact.abi)) throw new Error(`Missing compiled ${contract} ABI`);
  const target = new URL(path, ledger);
  const text = `${JSON.stringify(artifact.abi, null, 2)}\n`;
  if (check) {
    const committed = await readFile(target, "utf8").catch(() => null);
    if (committed !== text) throw new Error(`Generated artifact differs: ledger/${path}`);
  } else {
    await mkdir(new URL("schema/", ledger), { recursive: true });
    await writeFile(target, text);
  }
}
