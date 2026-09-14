import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CallData } from "starknet";
import { buildConfig } from "../../../../config/source/build-config";
import { buildPresetRegistration } from "../../../../config/deployer/clean/registrar/preset";
import { parseWorldParity, requiredParityCases } from "./parity-report";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const native = join(root, "contracts/l3/world-native");
const workspace = join(root, "deploy/madara-lab/.lab/native-oracle");
const oracle = join(workspace, "contracts/l3/game");
const spec = JSON.parse(await readFile(join(native, "fixtures/slice.json"), "utf8"));
const fixture = JSON.parse(await readFile(join(native, "fixtures/preset-1.json"), "utf8"));

if (JSON.stringify(Object.keys(spec.fixtureCases).sort()) !== JSON.stringify(Object.keys(requiredParityCases).sort()))
  throw new Error("Declared and enforced parity cases differ");
await validatePreset();
await prepareOracle();
const sourceDigest = await oracleSourceDigest();
const execution = await runParity();
let cases: ReturnType<typeof parseWorldParity> = [];
let failure: string | undefined;
try {
  if (execution.exitCode !== 0) throw new Error(`Parity execution exited ${execution.exitCode}`);
  cases = parseWorldParity(execution.output);
  if (sourceDigest !== (await oracleSourceDigest())) throw new Error("Oracle production source changed during the run");
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
}
const report = {
  version: 1,
  gate: "native-world-row-parity",
  passed: !failure,
  rulesRevision: spec.rulesRevision,
  oracleSourceSha256: sourceDigest,
  presetSha256: createHash("sha256").update(JSON.stringify(fixture)).digest("hex"),
  compiler: "2.13.1",
  foundry: "0.52.0",
  poolOverrides: false,
  normalization: spec.comparison.metadataNormalization,
  execution: {
    exitCode: execution.exitCode,
    elapsedMs: execution.elapsedMs,
    resourcesScope:
      "Fixture totals include both world deployments, configuration, actions, assertions and trace serialization. Per-action resources are measured by the lab harness.",
  },
  cases,
  ...(failure ? { failure } : {}),
};
await writeFile(join(native, "fixtures/world-parity.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ gate: report.gate, passed: report.passed, cases: cases.length, ...(failure ? { failure } : {}) }),
);
if (failure) process.exitCode = 1;

async function prepareOracle(): Promise<void> {
  if (fixture.rulesRevision !== spec.rulesRevision) throw new Error("Preset and rules revisions differ");
  await mkdir(workspace, { recursive: true });
  const archive = execFileSync("git", ["archive", spec.rulesRevision, "contracts/l3/game"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30_000,
  });
  execFileSync("tar", ["-xf", "-", "-C", workspace], { input: archive, timeout: 30_000 });
  await configureTestPackage();
  for (const [module, file] of Object.entries({
    native_parity: "oracle-parity",
    native_protocol: "oracle-protocol",
    native_preset: "oracle-preset",
    native_side_tables: "oracle-side-tables",
  })) {
    await writeFile(
      join(oracle, `src/${module}.cairo`),
      await readFile(join(root, `deploy/madara-lab/harness/native/${file}.cairo`)),
    );
  }
  await writeNativeInputs();
}

async function configureTestPackage(): Promise<void> {
  const manifestPath = join(oracle, "Scarb.toml");
  const manifest = await readFile(manifestPath, "utf8");
  if (!manifest.includes("[dev-dependencies]") || !manifest.includes("build-external-contracts = ["))
    throw new Error("Oracle test manifest shape changed");
  const external = ["map::MapDomain", "season::SeasonDomain", "troops::TroopsDomain", "structures::StructuresDomain"]
    .map((name) => `    "world_native::${name}",`)
    .concat(['    "eternum_randomness_protocol::authority::SequencingAccount",'])
    .join("\n");
  await writeFile(
    manifestPath,
    manifest
      .replace(
        "[dev-dependencies]",
        `[dev-dependencies]\nworld_native = { path = ${JSON.stringify(native)} }\neternum_randomness_protocol = { path = ${JSON.stringify(join(native, "../randomness-protocol"))} }`,
      )
      .replace("build-external-contracts = [", `build-external-contracts = [\n${external}`),
  );
  const libPath = join(oracle, "src/lib.cairo");
  const lib = await readFile(libPath, "utf8");
  await writeFile(
    libPath,
    `${lib}\n${["native_parity", "native_protocol", "native_preset", "native_side_tables", "native_inputs"].map((module) => `#[cfg(test)]\nmod ${module};`).join("\n")}\n`,
  );
}

async function oracleSourceDigest(): Promise<string> {
  const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", spec.rulesRevision, "contracts/l3/game/src"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  })
    .trim()
    .split("\n")
    .filter((path) => path !== "contracts/l3/game/src/lib.cairo");
  const hash = createHash("sha256");
  for (const path of paths) {
    const expected = execFileSync("git", ["show", `${spec.rulesRevision}:${path}`], {
      cwd: root,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    });
    const actual = await readFile(join(workspace, path));
    if (!actual.equals(expected)) throw new Error(`Oracle source differs from pinned rules: ${path}`);
    hash.update(path).update(actual);
  }
  return hash.digest("hex");
}

async function runParity() {
  const started = performance.now();
  const log = join(workspace, "world-parity.log");
  await writeFile(log, "");
  await writeFile(`${log}.stderr`, "");
  const child = Bun.spawn(["snforge", "test", "world_parity_", "--max-n-steps", "200000000"], {
    cwd: oracle,
    env: { ...process.env, ASDF_STARKNET_FOUNDRY_VERSION: "0.52.0" },
    stdout: Bun.file(log),
    stderr: Bun.file(`${log}.stderr`),
  });
  const timeout = setTimeout(() => child.kill(), 15 * 60_000);
  let exitCode: number;
  try {
    exitCode = await child.exited;
  } finally {
    clearTimeout(timeout);
  }
  return {
    exitCode,
    elapsedMs: Math.round(performance.now() - started),
    output: `${await readFile(log, "utf8")}\n${await readFile(`${log}.stderr`, "utf8")}`,
  };
}

async function validatePreset(): Promise<void> {
  execFileSync(
    "git",
    ["diff", "--exit-code", spec.rulesRevision, "--", "config/source", "config/deployer/clean/registrar/preset.ts"],
    { cwd: root, stdio: "pipe", timeout: 30_000 },
  );
  const config = await buildConfig({ gameType: "eternum", chain: "madara" });
  const expected = buildPresetRegistration(config, 1);
  if (canonical(expected) !== canonical(fixture.oraclePreset))
    throw new Error("Preset fixture differs from pinned configuration");
  for (const [key, value] of Object.entries(fixture.rules)) {
    if (
      key in fixture.oraclePreset.presetConfig &&
      canonical(value) !== canonical(fixture.oraclePreset.presetConfig[key])
    )
      throw new Error(`Native rule differs from original preset: ${key}`);
  }
}

async function writeNativeInputs(): Promise<void> {
  const schema = JSON.parse(await readFile(join(native, "schema/schema.json"), "utf8"));
  const abi = [
    ...Object.values(schema.types),
    {
      type: "function",
      name: "rules",
      inputs: [{ name: "rules", type: "world_native::rules::SliceRules" }],
      outputs: [],
      state_mutability: "view",
    },
    {
      type: "function",
      name: "resources",
      inputs: [{ name: "rules", type: "core::array::Span::<world_native::structures::ResourceRule>" }],
      outputs: [],
      state_mutability: "view",
    },
  ];
  const calldata = new CallData(abi as ConstructorParameters<typeof CallData>[0]);
  const rules = calldata.compile("rules", { rules: fixture.rules });
  const resources = calldata.compile("resources", { rules: fixture.resources });
  const decode = (name: string, type: string, data: string[]) =>
    `pub fn ${name}() -> ${type} { let mut raw=array![${data.join(",")}].span(); let result=Serde::deserialize(ref raw).unwrap(); assert!(raw.is_empty()); result }`;
  await writeFile(
    join(oracle, "src/native_inputs.cairo"),
    `${decode("rules", "world_native::rules::SliceRules", rules)}\n${decode("resource_rules", "Span<world_native::structures::ResourceRule>", resources)}\n`,
  );
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  if (
    typeof value === "bigint" ||
    typeof value === "number" ||
    (typeof value === "string" && /^(0x[0-9a-f]+|[0-9]+)$/i.test(value))
  )
    return JSON.stringify(BigInt(value).toString());
  return JSON.stringify(value);
}
