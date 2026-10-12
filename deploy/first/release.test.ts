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
    next: revision,
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
      if (argv[1] === "merge-base") return state.ancestor;
      if (argv[1] === "rev-parse") {
        if (argv[2] === "HEAD") return state.tree;
        if (argv[2]!.endsWith("^{tree}")) return revision;
        return state.next;
      }
      if (argv[1] === "status") return state.dirty;
    }
    if (argv[0] === "gh" && argv[1] === "run") return JSON.stringify(state.validation);
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
    revision,
    store,
    platform,
    output: () => {},
  } as Deployment;
  const step = (name: string) => deliverySteps(context).find((step) => step.name === name)!;
  return { state, calls, step, platform };
}
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
  expect(error.message).toContain(`clean checkout of commit ${revision}`);
  expect(calls.every((args) => args[0] === "git")).toBe(true);
});
test("an old tree refuses client deployment before any build", async () => {
  const { state, platform } = setup();
  state.tree = oldRevision;
  const error = await deployClient(platform, revision).catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toContain(`clean checkout of commit ${revision}`);
});
