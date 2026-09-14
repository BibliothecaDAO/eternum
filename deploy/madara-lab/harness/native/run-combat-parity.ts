import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const native = join(root, "contracts/l3/world-native");
const workspace = join(root, "deploy/madara-lab/.lab/native-combat-oracle");
const oracle = join(workspace, "contracts/l3/game");
const spec = JSON.parse(await readFile(join(native, "fixtures/slice.json"), "utf8")) as { rulesRevision: string };

await prepareOracle();
const nativeRun = await runVectors("native", native);
const oracleRun = await runVectors("dojo", oracle);
const nativeRows = parseRows(nativeRun.output);
const oracleRows = parseRows(oracleRun.output);
const passed =
  nativeRun.exitCode === 0 &&
  oracleRun.exitCode === 0 &&
  nativeRows.length === 4 &&
  oracleRows.length === 4 &&
  equalRows(nativeRows, oracleRows);
const report = {
  version: 1,
  gate: "combat-calculation-parity",
  passed,
  rulesRevision: spec.rulesRevision,
  compiler: "2.13.1",
  foundry: "0.52.0",
  scope: "Four combat-library inputs; full action and world-row parity are separate gates.",
  cases: nativeRows.map((values, index) => ({
    index,
    native: values,
    dojo: oracleRows[index],
    equal: equalRows([values], [oracleRows[index] ?? []]),
  })),
  execution: {
    native: { exitCode: nativeRun.exitCode, elapsedMs: nativeRun.elapsedMs, l2Gas: parseGas(nativeRun.output) },
    dojo: { exitCode: oracleRun.exitCode, elapsedMs: oracleRun.elapsedMs, l2Gas: parseGas(oracleRun.output) },
  },
};
await writeFile(join(native, "fixtures/combat-parity.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ gate: report.gate, passed, cases: report.cases.length }));
if (!passed) process.exitCode = 1;

async function prepareOracle(): Promise<void> {
  await mkdir(workspace, { recursive: true });
  const archive = execFileSync("git", ["archive", spec.rulesRevision, "contracts/l3/game"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  execFileSync("tar", ["-xf", "-", "-C", workspace], { input: archive });
  await writeFile(
    join(oracle, "src/native_combat_vectors.cairo"),
    (await readFile(join(native, "src/parity_vectors.cairo"), "utf8")).replaceAll(
      "                    timestamp: 1200,\n",
      "",
    ),
  );
  const libPath = join(oracle, "src/lib.cairo");
  const original = await readFile(libPath, "utf8");
  await writeFile(
    libPath,
    `${original}\n#[cfg(test)]\nmod native_combat_vectors;\n#[cfg(test)]\npub mod parity_types {
    pub use crate::utils::map::biomes::Biome;
    pub use crate::models::troop::{CombatContext, TroopsTrait, TroopBoosts, TroopTier, TroopType, Troops};
    pub use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
    pub use crate::models::stamina::Stamina;
}\n`,
  );
}

async function runVectors(name: string, cwd: string): Promise<{ output: string; exitCode: number; elapsedMs: number }> {
  const started = performance.now();
  const log = join(workspace, `${name}-combat.log`);
  await writeFile(log, "");
  await writeFile(`${log}.stderr`, "");
  const child = Bun.spawn(["snforge", "test", "combat_parity_vectors"], {
    cwd,
    env: { ...process.env, ASDF_STARKNET_FOUNDRY_VERSION: "0.52.0" },
    stdout: Bun.file(log),
    stderr: Bun.file(`${log}.stderr`),
  });
  const exitCode = await child.exited;
  return {
    output: `${await readFile(log, "utf8")}\n${await readFile(`${log}.stderr`, "utf8")}`,
    exitCode,
    elapsedMs: Math.round(performance.now() - started),
  };
}

function parseRows(output: string): string[][] {
  const rows: string[][] = [];
  for (const match of output.matchAll(/^PARITY_COMBAT (\d+) (\d+) (\d+)$/gm)) {
    const row = Number(match[1]);
    const member = Number(match[2]);
    rows[row] ??= [];
    if (rows[row].length !== member) throw new Error(`Missing or duplicate combat member ${row}:${member}`);
    rows[row].push(`0x${BigInt(match[3]).toString(16)}`);
  }
  return rows;
}

function equalRows(left: string[][], right: string[][]): boolean {
  return (
    left.length > 0 &&
    left.length === right.length &&
    left.every(
      (row, index) =>
        row.length === 28 &&
        right[index]?.length === row.length &&
        row.every((value, member) => value === right[index][member]),
    )
  );
}

function parseGas(output: string): number | null {
  const gas = output.match(/\[PASS\].*combat_parity_vectors .*l2_gas: ~(\d+)/);
  return gas ? Number(gas[1]) : null;
}
