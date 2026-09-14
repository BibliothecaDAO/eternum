import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const scope = [
  "apps/herald",
  "contracts/l3/world-native",
  "packages",
  "config",
  "deploy/madara-lab/harness",
  "package.json",
  "pnpm-lock.yaml",
  ".github/workflows/native-world.yml",
];
const reports = new Set(
  ["harness.json", "herald-replay.json", "deploy-upgrade.json", "world-parity.json", "combat-parity.json"].map(
    (file) => `contracts/l3/world-native/fixtures/${file}`,
  ),
);

/** Output reports cannot hash themselves. The declared source/configuration scope is covered, including generated schemas. */
export async function sourceProvenance(requireClean: boolean) {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const dirty = git("status", "--porcelain").length !== 0;
  if (requireClean && dirty)
    throw new Error("Evidence requires a clean worktree; commit the source changes before running");
  const paths = git("ls-files", "--", ...scope)
    .split("\n")
    .filter((path) => !reports.has(path))
    .sort();
  const digest = createHash("sha256");
  for (const path of paths)
    digest
      .update(path)
      .update("\0")
      .update(await readFile(resolve(root, path)))
      .update("\0");
  return {
    revision: git("rev-parse", "HEAD"),
    dirty,
    sourceSha256: digest.digest("hex"),
    scope,
    excludedReports: [...reports].sort(),
  };
}
