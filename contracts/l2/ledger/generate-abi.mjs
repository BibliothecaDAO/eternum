import { mkdir, readFile, writeFile } from "node:fs/promises";

const ledger = new URL("./", import.meta.url);
const artifact = JSON.parse(await readFile(new URL("target/dev/game_ledger_GameLedger.contract_class.json", ledger)));
if (!Array.isArray(artifact.abi)) throw new Error("Missing compiled GameLedger ABI");

const target = new URL("schema/abi.json", ledger);
const text = `${JSON.stringify(artifact.abi, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== text) throw new Error("Generated artifact differs: ledger/schema/abi.json");
} else {
  await mkdir(new URL("schema/", ledger), { recursive: true });
  await writeFile(target, text);
}
