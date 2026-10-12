import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Target } from "./settings";
import { command, shell, CommandFailure } from "./process";
import type { PrivateStore } from "./private-store";
import { PublicError } from "./dates";

export const artifactFiles = [
  ["ledger", "game_ledger_TestLords"],
  ["ledger", "game_ledger_GameLedger"],
  ["mmr", "mmr_MMRToken"],
  ["collectibles", "collectibles_RealmsCollectible"],
].flatMap(([packageName, base]) =>
  ["contract_class.json", "compiled_contract_class.json"].map((suffix) => ({ packageName, file: `${base}.${suffix}` })),
);
export const remoteCheckout = (revision: string) => `/home/ubuntu/cairo-suite/first-release-${revision}`;
export function releaseDirectory(target: Target) {
  return target.runDirectory;
}
export async function boxRead(target: Target, script: string) {
  return command({
    argv: [
      "ssh",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "UpdateHostKeys=no",
      "-o",
      "ControlMaster=no",
      "-o",
      "ControlPath=none",
      target.box,
      "bash",
      "-s",
    ],
    input: `set -euo pipefail\n${script}\n`,
  });
}
export async function deployShard(target: Target, revision: string, output: (line: string) => void) {
  const checkout = remoteCheckout(revision);
  try {
    const result = await boxRead(
      target,
      `if [ ! -d ${shell(checkout)} ]; then git clone --no-checkout https://github.com/BibliothecaDAO/eternum.git ${shell(checkout)} >/dev/null 2>&1; fi\ncd ${shell(checkout)}\ngit fetch origin ${revision} >/dev/null 2>&1\ngit checkout --detach ${revision} >/dev/null 2>&1\npython3 deploy/first/box-deploy.py ${shell(target.release)} ${shell(releaseDirectory(target))} ${revision}`,
    );
    if (JSON.parse(result).restarted) output("Restarting the unfinished pending shard from fresh state.");
  } catch (error) {
    if (error instanceof CommandFailure) {
      let report;
      try {
        report = JSON.parse(error.stdout);
      } catch {
        /* Unstructured output stays private. */
      }
      if (report?.restarted) output("Restarting the unfinished pending shard from fresh state.");
      if (report?.kind === "shard-deployment-refused" && typeof report.message === "string") {
        if (
          report.message.includes("self-check") &&
          report.message !== "Shard deployment stopped at self-check." &&
          !/^Shard deployment stopped at self-check\. self-check failed at [A-Za-z_]{1,64}: (?:(?:timeout|verify|other)|refused: [A-Za-z0-9 ,:._()/-]{1,256} \(transaction 0x[0-9a-fA-F]{1,64}\)); directory status unchanged$/.test(
            report.message,
          )
        )
          throw error;
        throw new PublicError(report.message);
      }
    }
    throw error;
  }
}
export async function artifactsReady(store: PrivateStore, revision: string) {
  const built = store.read<{ revision: string }>("build.json");
  if (!built || !artifactFiles.every(({ file }) => existsSync(join(store.directory, "artifacts", file)))) return false;
  if (built.revision === revision) return true;
  try {
    return !(
      await command({
        argv: [
          "git",
          "diff",
          "--name-only",
          built.revision,
          revision,
          "--",
          "contracts/l2/ledger",
          "contracts/l2/mmr",
          "contracts/l2/collectibles",
          "deploy/first/box.ts",
        ],
      })
    ).trim();
  } catch {
    return false;
  }
}
export async function buildArtifacts(target: Target, store: PrivateStore, revision: string) {
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("Invalid release revision");
  const checkout = remoteCheckout(revision);
  await boxRead(
    target,
    `
mkdir -p "$HOME/cairo-suite"
exec 9>"$HOME/cairo-suite/.lock"
flock 9
if [ ! -d ${shell(checkout)} ]; then git clone --no-checkout https://github.com/BibliothecaDAO/eternum.git ${shell(checkout)} >/dev/null 2>&1; fi
cd ${shell(checkout)}
git fetch origin ${revision} >/dev/null 2>&1
git checkout --detach ${revision} >/dev/null 2>&1
export PATH="$HOME/cairo-suite/tool-data/scarb-install/2.13.1/bin:$HOME/.local/bin:$PATH"
scarb --version | head -1 | grep -q '2.13.1'
for package in ledger mmr collectibles; do (cd contracts/l2/$package && taskset -c 8-11 scarb --release build >/dev/null 2>&1); done
`,
  );
  const directory = join(store.directory, "artifacts");
  mkdirSync(directory, { mode: 0o700, recursive: true });
  for (const { packageName, file } of artifactFiles) {
    const data = await boxRead(
      target,
      `cat ${shell(`${checkout}/contracts/l2/${packageName}/target/release/${file}`)}`,
    );
    JSON.parse(data);
    writeFileSync(join(directory, file), data, { mode: 0o600 });
  }
  store.write("build.json", { revision });
}
export async function nativeDocument(target: Target) {
  const text = await boxRead(
    target,
    `if [ -f ${shell(`${releaseDirectory(target)}/data/native-world.json`)} ]; then cat ${shell(`${releaseDirectory(target)}/data/native-world.json`)}; else echo null; fi`,
  );
  return JSON.parse(text) as { shard: { chainId: string }; world: { address: string } } | null;
}
export async function installedOperatorToken(target: Target) {
  // The owner process adopts the existing environment credential without displaying it.
  return boxRead(
    target,
    `python3 - <<'PY'
import os, stat
p='/opt/athanor/operator-token'
if os.path.lexists(p):
 fd=os.open(p, os.O_RDONLY|os.O_NOFOLLOW)
 s=os.fstat(fd)
 if not stat.S_ISREG(s.st_mode) or stat.S_IMODE(s.st_mode)!=0o600 or s.st_uid!=os.geteuid(): raise SystemExit(1)
 with os.fdopen(fd) as f: print(f.read().strip())
PY`,
  );
}
export async function installOperatorToken(target: Target, token: string) {
  // The remote command is fixed; the credential travels only on encrypted standard input.
  const program = `import os,sys,stat; p='/opt/athanor/operator-token'; v=sys.stdin.read(); os.umask(0o077); fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600); os.write(fd,v.encode()); os.close(fd)`;
  await command({
    argv: [
      "ssh",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "UpdateHostKeys=no",
      "-o",
      "ControlMaster=no",
      "-o",
      "ControlPath=none",
      target.box,
      `python3 -c ${shell(program)}`,
    ],
    input: token,
  });
}

export async function operatorTokenPresent(target: Target) {
  const result = await boxRead(
    target,
    `python3 - <<'PYTHON'
import os,stat
p='/opt/athanor/operator-token'
if not os.path.lexists(p): print('absent')
else:
 s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or stat.S_IMODE(s.st_mode)!=0o600 or s.st_uid!=os.geteuid(): raise SystemExit(1)
 print('present')
PYTHON`,
  );
  return result.trim() === "present";
}
