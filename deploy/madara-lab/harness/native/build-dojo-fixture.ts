import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import spec from "../../../../contracts/l3/world-native/fixtures/slice.json";

const root = resolve(import.meta.dir, "../../../..");
const workspace = resolve(root, "deploy/madara-lab/.lab/native-oracle");
const oracle = resolve(workspace, "contracts/l3/game");

await restorePinnedOracle();
await installLabFixture();
await compileFixture();

async function restorePinnedOracle() {
  await mkdir(workspace, { recursive: true });
  const archive = execFileSync("git", ["archive", spec.rulesRevision, "contracts/l3/game"], {
    cwd: root,
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  execFileSync("tar", ["-xf", "-", "-C", workspace], { input: archive, timeout: 30_000 });
}

async function installLabFixture() {
  await copyFile(resolve(import.meta.dir, "lab-slice.cairo"), resolve(oracle, "src/lab_slice.cairo"));
  const path = resolve(oracle, "src/lib.cairo");
  await writeFile(path, `${await readFile(path, "utf8")}\nmod lab_slice;\n`);
}

async function compileFixture() {
  const child = Bun.spawn(["scarb", "build"], { cwd: oracle, stdout: "inherit", stderr: "inherit" });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Dojo lab fixture build exited ${exitCode}`);
}
