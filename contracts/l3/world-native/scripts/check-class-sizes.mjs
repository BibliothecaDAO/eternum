import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const chainLimit = 81_920;
const headroomLimit = 75_366;

export async function classSizeReport(directory, schema) {
  const contracts = await readArtifactIndex(directory);
  const required = new Set([
    schema.games.contract,
    ...Object.values(schema.logicClasses),
    "SequencingAccount",
    ...contracts.keys(),
  ]);
  const classes = await Promise.all(
    [...required].sort().map((name) => measureClass(directory, name, contracts.get(name))),
  );
  return { chainLimit, headroomLimit, classes, passed: classes.every(({ passed }) => passed) };
}

async function readArtifactIndex(directory) {
  const index = JSON.parse(await readFile(resolve(directory, "world_native.starknet_artifacts.json"), "utf8"));
  const contracts = new Map();
  for (const contract of index.contracts) {
    if (contracts.has(contract.contract_name)) throw new Error(`Duplicate class ${contract.contract_name}`);
    contracts.set(contract.contract_name, contract.artifacts.casm);
  }
  return contracts;
}

async function measureClass(directory, name, artifact) {
  try {
    if (!artifact) throw new Error("Missing compiled class in artifact index");
    const { bytecode } = JSON.parse(await readFile(resolve(directory, artifact), "utf8"));
    if (!Array.isArray(bytecode) || bytecode.length === 0) throw new Error("Missing CASM bytecode");
    const felts = bytecode.length;
    return { name, felts, percent: (100 * felts) / chainLimit, passed: felts <= headroomLimit };
  } catch (error) {
    return { name, felts: null, percent: null, passed: false, error: error.message };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL("../", import.meta.url);
  const schema = JSON.parse(await readFile(new URL("schema/schema.json", root), "utf8"));
  const report = await classSizeReport(fileURLToPath(new URL("target/dev/", root)), schema);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}
