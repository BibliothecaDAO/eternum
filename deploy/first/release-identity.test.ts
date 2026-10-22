import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import * as processTools from "./process";
import { PrivateStore } from "./private-store";
import { readReleaseIdentity, recordReleaseIdentity, RELEASE_SOURCES } from "./release-identity";
import { environments, root } from "./settings";
import { NATIVE_RELEASE_ID } from "../release/native-release";

const commit = "c".repeat(40);
const built = "b".repeat(40);
const target = environments.dev;
const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function store() {
  const base = mkdtempSync(join(tmpdir(), "release-identity-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repository"));
  return new PrivateStore(join(base, "private"), join(base, "repository"), true);
}
/** The box's build record as `release.json` holds it, written by the box half at `commit`. */
const boxBuild = (buildCommit: string, releaseId = NATIVE_RELEASE_ID) => ({
  commit: buildCommit,
  releaseId,
  schema: "2fbdecd09f961d7b387524eef591d8a0185c2dea59c7c334560c9789a444149e",
  migrationClassHash: "0x0",
  classes: { games: "0x7c78", logic: { season: "0x55e0", troops: "0x77a2" }, account: "0x1", verifier: "0x2" },
  presets: { "5": "0x4a07" },
  images: { init: "sha256:1" },
});
const IDENTITY = {
  releaseId: NATIVE_RELEASE_ID,
  schema: "2fbdecd09f961d7b387524eef591d8a0185c2dea59c7c334560c9789a444149e",
  logic: { season: "0x55e0", troops: "0x77a2" },
  migration: "0x0",
};
/** The box answers `record` over SSH; git compares the two commits' release sources as `sourcesDiffer` says. */
function box(record: unknown, sourcesDiffer = false) {
  const calls: processTools.Command[] = [];
  spyOn(processTools, "command").mockImplementation(async (spec) => {
    calls.push(spec);
    if (spec.argv[0] === "ssh") return JSON.stringify(record);
    if (spec.argv.slice(0, 2).join(" ") === "git diff" && sourcesDiffer) throw new processTools.CommandFailure("");
    return "";
  });
  return calls;
}

test("the box's build of this very commit is the release the deploy carries", async () => {
  const value = store();
  const calls = box(boxBuild(commit));
  await recordReleaseIdentity(value, target, commit);
  expect(readReleaseIdentity(value, commit)).toEqual(IDENTITY);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.argv).toContain(target.box);
  expect(String(calls[0]!.input)).toContain(`${target.runDirectory}/release.json`);
});

test("another commit's box build stands for this one when their release sources are identical", async () => {
  const value = store();
  const calls = box(boxBuild(built));
  await recordReleaseIdentity(value, target, commit);
  expect(readReleaseIdentity(value, commit)).toEqual(IDENTITY);
  expect(calls.slice(1).map((call) => call.argv)).toEqual([
    ["git", "fetch", "--quiet", "origin", built],
    ["git", "diff", "--quiet", built, commit, "--", ...RELEASE_SOURCES],
  ]);
});

test("a box build whose release sources differ is refused, and nothing is recorded", async () => {
  const value = store();
  box(boxBuild(built), true);
  await expect(recordReleaseIdentity(value, target, commit)).rejects.toThrow(
    `The box half built ${built.slice(0, 11)}, whose release sources differ from this commit's. Run the box half at this commit first.`,
  );
  expect(() => readReleaseIdentity(value, commit)).toThrow("No release identity was read for this commit");
});

test("a box build of another release number is refused", async () => {
  box(boxBuild(commit, NATIVE_RELEASE_ID - 1));
  await expect(recordReleaseIdentity(store(), target, commit)).rejects.toThrow(
    `The box half built release ${NATIVE_RELEASE_ID - 1}; this commit ships release ${NATIVE_RELEASE_ID}.`,
  );
});

test("a box that never built records no release, which the launch Worker accepts only without an active shard", async () => {
  const value = store();
  box(null);
  await recordReleaseIdentity(value, target, commit);
  expect(readReleaseIdentity(value, commit)).toBeNull();
});

test("an identity read for another commit never stands in for this one", async () => {
  const value = store();
  box(boxBuild(built));
  await recordReleaseIdentity(value, target, built);
  expect(() => readReleaseIdentity(value, commit)).toThrow("No release identity was read for this commit");
});

/** The Scarb packages a world build compiles: world-native and every path dependency, followed transitively. */
function scarbPackages(directory: string, seen = new Set<string>()): Set<string> {
  if (seen.has(directory)) return seen;
  seen.add(directory);
  const manifest = readFileSync(join(directory, "Scarb.toml"), "utf8");
  for (const [, path] of manifest.matchAll(/path\s*=\s*"([^"]+)"/g)) scarbPackages(resolve(directory, path!), seen);
  return seen;
}

test("the release sources hold every package the world's contracts build from", () => {
  const packages = [...scarbPackages(join(root, "contracts/l3/world-native"))].map((path) => relative(root, path));
  for (const path of packages)
    expect(RELEASE_SOURCES.some((source) => path === source || path.startsWith(`${source}/`))).toBe(true);
  expect(packages).toContain("contracts/l3/vrf-verifier");
  expect(readFileSync(join(root, "deploy/shard/Dockerfile"), "utf8")).toContain("bun deploy/release/facts.ts");
});
