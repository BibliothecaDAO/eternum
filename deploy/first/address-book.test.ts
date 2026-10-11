import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import { deliverySteps } from "./delivery";
import { PrivateStore } from "./private-store";
import type { Deployment } from "./main";
import { environments } from "./settings";

const book = "contracts/common/addresses/dev.json";
const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function setup(head: string, remote: string, dirty = true) {
  const base = mkdtempSync(join(tmpdir(), "address-book-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  const calls: string[][] = [];
  const output: string[] = [];
  const state = { head, remote, dirty, parents: `${head} ${remote}`, changed: book, failPush: false };
  spyOn(processTools, "command").mockImplementation(async ({ argv }) => {
    calls.push(argv);
    if (argv[1] === "rev-parse") return `${state.head}\n${state.remote}\n`;
    if (argv[1] === "status") return state.dirty ? ` M ${book}` : "";
    if (argv[1] === "rev-list") return state.parents;
    if (argv[1] === "diff" && !argv.includes("--cached")) return state.changed;
    if (argv[1] === "commit") {
      state.head = "book-commit";
      state.parents = `${state.head} ${state.remote}`;
      state.dirty = false;
    }
    if (argv[1] === "push") {
      if (state.failPush) throw new Error("Push failed");
      state.remote = state.head;
    }
    if (argv[0] === "gh") return '{"number":5039}';
    return "";
  });
  const context = {
    target: environments.dev,
    environment: "dev",
    apply: true,
    revision: head,
    store,
    assets: { ledger: "0x1", lords: "0x2", mmr: "0x3", chests: "0x4", cosmetics: "0x5" },
    output: (line: string) => output.push(line),
  } as Deployment;
  return {
    calls,
    store,
    state,
    output,
    step: deliverySteps(context).find((step) => step.name === "Public address book commit")!,
  };
}
function mutations(calls: string[][]) {
  return calls.filter((args) => args[0] === "git" && ["add", "commit", "push"].includes(args[1]!));
}
test.each(["ahead", "behind"])("a %s checkout with an uncommitted book stops before publishing", async (head) => {
  const { step, calls } = setup(head, "remote");
  await expect(step.apply()).rejects.toThrow(
    "HEAD must equal origin/stack/node-first before committing the address book.",
  );
  expect(mutations(calls)).toEqual([]);
  expect(calls).toContainEqual(["git", "fetch", "origin", "stack/node-first"]);
});
test("an exact remote head commits only the public book after fetching", async () => {
  const { step, calls, store } = setup("same", "same");
  await step.apply();
  const fetch = calls.findIndex((args) => args[1] === "fetch");
  const add = calls.findIndex((args) => args[1] === "add");
  expect(fetch).toBeLessThan(add);
  expect(calls[add]).toEqual(["git", "add", "--", book]);
  expect(calls.find((args) => args[1] === "commit")!.slice(-2)).toEqual(["--", book]);
  expect(calls.find((args) => args[1] === "push")).toEqual(["git", "push", "origin", "HEAD:stack/node-first"]);
  expect(store.read<{ number: number }>("pull-request.json")).toEqual({ number: 5039 });
});
test("a failed push resumes with the existing book commit, then records the pull request", async () => {
  const { step, calls, state, store, output } = setup("same", "same");
  state.failPush = true;
  await expect(step.apply()).rejects.toThrow("Push failed");
  expect(store.read("pull-request.json")).toBeUndefined();
  expect((await step.inspect()).done).toBe(false);
  state.failPush = false;
  calls.length = 0;
  output.length = 0;
  await step.apply();
  expect(mutations(calls)).toEqual([["git", "push", "origin", "HEAD:stack/node-first"]]);
  expect(output).toEqual([
    "Found one unpushed address-book-only commit above origin/stack/node-first; retrying its push.",
  ]);
  expect((await step.inspect()).done).toBe(true);
});
test("a committed book at the remote head needs no additional commit", async () => {
  const { step, calls, output } = setup("same", "same", false);
  await step.apply();
  expect(mutations(calls)).toEqual([["git", "push", "origin", "HEAD:stack/node-first"]]);
  expect(output).toEqual(["HEAD matches origin/stack/node-first; the public address book can be published."]);
});
test.each([
  ["behind", "local older", book],
  ["diverged", "local other", book],
  ["two ahead", "local intermediate", book],
  ["merge", "local remote second-parent", book],
  ["other files", "local remote", `${book}\npackage.json`],
  ["other environment book", "local remote", "contracts/common/addresses/mainnet.json"],
  ["empty commit", "local remote", ""],
])("a clean book refuses %s history before any push", async (_label, parents, changed) => {
  const { step, calls, state } = setup("local", "remote", false);
  Object.assign(state, { parents, changed });
  await expect(step.apply()).rejects.toThrow(
    "HEAD is neither origin/stack/node-first nor one address-book-only commit ahead; nothing was pushed.",
  );
  expect(mutations(calls)).toEqual([]);
});
