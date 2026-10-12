import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import { deliverySteps } from "./delivery";
import { deployWorkers, deployClient } from "./publish";
import { PrivateStore } from "./private-store";
import type { Deployment } from "./main";
import { environments, type Inputs } from "./settings";
import { Platform } from "./platform";
import release from "../release/staging.json";
import { PublicError } from "./dates";

const revision = "b".repeat(40);
const oldRevision = "a".repeat(40);
const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function setup() {
  const base = mkdtempSync(join(tmpdir(), "release-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  store.write("pull-request.json", { number: 5039 });
  const state = {
    tag: revision,
    next: revision,
    nextPackage: release.package,
    ancestor: revision,
    validation: [{ conclusion: "success", event: "push" }],
    native: "null",
    proof: "null",
    tree: revision,
    dirty: "",
  };
  const calls: string[][] = [];
  spyOn(processTools, "command").mockImplementation(async ({ argv, input }) => {
    calls.push(argv);
    if (argv[0] === "git") {
      if (argv[1] === "fetch") return "";
      if (argv[1] === "show") return JSON.stringify({ package: state.nextPackage });
      if (argv[1] === "ls-remote") return state.tag ? `${state.tag}\trefs/tags/${release.package}^{}` : "";
      if (argv[1] === "merge-base") return state.ancestor;
      if (argv[1] === "rev-parse") {
        if (argv[2] === "HEAD^{tree}") return state.tree;
        if (argv[2]!.endsWith("^{tree}")) return revision;
        return state.next;
      }
      if (argv[1] === "status") return state.dirty;
    }
    if (argv[0] === "gh" && argv[1] === "run") return JSON.stringify(state.validation);
    if (argv[0] === "gh" && argv[1] === "release") return JSON.stringify({ assets: [{ name: "shard.tar.gz" }] });
    if (argv[0] === "ssh")
      return typeof input === "string" && input.includes("native-world.json") ? state.native : state.proof;
    throw new Error(`Unexpected test command: ${argv.slice(0, 2).join(" ")}`);
  });
  const platform = new Platform(
    environments.dev,
    { rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway" } as Inputs,
    store,
    true,
  );
  platform.deployedVersion = async () => ({ id: "old", revision: oldRevision });
  platform.clientRevision = async () => oldRevision;
  const context = {
    target: environments.dev,
    environment: "dev",
    apply: true,
    revision: oldRevision,
    store,
    platform,
    output: () => {},
  } as Deployment;
  const step = (name: string) => deliverySteps(context).find((step) => step.name === name)!;
  return { state, calls, step, platform };
}
test("a new release tag ignores the old saved pull request, including when next has advanced", async () => {
  const { state, step, calls } = setup();
  state.next = "c".repeat(40);
  expect((await step("Owner release tag").inspect()).done).toBe(true);
  expect(calls.some((args) => args[0] === "gh" && args[1] === "pr")).toBe(false);
  expect(calls.filter((args) => args[1] === "run").every((args) => args.includes(revision))).toBe(true);
});
test("an absent tag prints the exact owner commands for origin/next without tagging", async () => {
  const { state, step, calls } = setup();
  state.tag = "";
  expect((await step("Owner release tag").inspect()).waiting).toBe(
    `Owner commands: git fetch origin next; git tag ${release.package} ${revision}; git push origin refs/tags/${release.package}; then rerun`,
  );
  expect(calls.some((args) => ["tag", "push"].includes(args[1]!))).toBe(false);
});
test("a tag outside next is refused even if it has green validation", async () => {
  const { state, step } = setup();
  state.ancestor = oldRevision;
  await expect(step("Owner release tag").inspect()).rejects.toThrow("not on origin/next");
  await expect(step("Workers").inspect()).rejects.toThrow("not on origin/next");
});
const validationCases: { validation: { conclusion: string; event: string }[] }[] = [
  { validation: [] },
  { validation: [{ conclusion: "success", event: "pull_request" }] },
];
test.each(validationCases)("only green push validation authorizes release %j", async ({ validation }) => {
  const { state, step } = setup();
  state.validation = validation;
  expect((await step("Owner release tag").inspect()).waiting).toContain("push run");
  expect((await step("Workers").inspect()).done).toBe(false);
});
test.each(["Workers", "Client", "Shard deployment and self-check"])(
  "%s cannot count the old release or missing box as done",
  async (name) => {
    const { step } = setup();
    const observation = await step(name).inspect();
    expect(observation.done).toBe(false);
    expect(observation.waiting).toBeUndefined();
  },
);
test("an old shard proof cannot count as the new release", async () => {
  const { state, step } = setup();
  state.native = JSON.stringify({ shard: { chainId: `0x${Buffer.from(release.chain_id).toString("hex")}` } });
  state.proof = JSON.stringify({ revision: oldRevision });
  expect((await step("Shard deployment and self-check").inspect()).done).toBe(false);
});
test.each(["old tree", "dirty tree"])("%s refuses Worker deployment before any build", async (condition) => {
  const { state, platform, calls } = setup();
  if (condition === "old tree") state.tree = oldRevision;
  else state.dirty = " M deploy/first/delivery.ts";
  const error = await deployWorkers(platform, revision).catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toContain(`git checkout --detach ${release.package}`);
  expect(calls.every((args) => args[0] === "git")).toBe(true);
});
test("an old tree refuses client deployment before any build", async () => {
  const { state, platform } = setup();
  state.tree = oldRevision;
  const error = await deployClient(platform, revision).catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toContain(`git checkout --detach ${release.package}`);
});

test("an unmerged release package prints no owner tag command", async () => {
  const { state, step, calls } = setup();
  state.tag = "";
  state.nextPackage = "shard-v0.7.0-rc.1";
  const error = await step("Owner release tag")
    .inspect()
    .catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toBe(`The release file naming ${release.package} is not on next yet; merge it before tagging.`);
  expect(error.message).not.toContain("git tag");
  expect(calls).toContainEqual(["git", "show", `${revision}:deploy/release/staging.json`]);
  expect(calls.some((args) => ["tag", "push"].includes(args[1]!))).toBe(false);
});
