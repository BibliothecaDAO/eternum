import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import { deliverySteps } from "./delivery";
import { PrivateStore } from "./private-store";
import type { Deployment } from "./main";
import { environments } from "./settings";

const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function setup(head: string, remote: string) {
  const base = mkdtempSync(join(tmpdir(), "address-book-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  const calls: string[][] = [];
  spyOn(processTools, "command").mockImplementation(async ({ argv }) => {
    calls.push(argv);
    if (argv[1] === "rev-parse") return `${head}\n${remote}\n`;
    if (argv[1] === "status") return " M contracts/common/addresses/dev.json";
    if (argv[0] === "gh") return '{"number":5039}';
    return "";
  });
  const context = {
    target: environments.dev,
    environment: "dev",
    apply: true,
    revision: head,
    store,
    output: () => {},
  } as Deployment;
  return { calls, store, step: deliverySteps(context).find((step) => step.name === "Public address book commit")! };
}
test.each([
  ["ahead", "remote"],
  ["behind", "remote"],
])("a %s checkout stops before staging, committing or pushing", async (head, remote) => {
  const { step, calls } = setup(head, remote);
  await expect(step.apply()).rejects.toThrow(
    "HEAD must equal origin/stack/node-first before committing the address book.",
  );
  expect(calls).toEqual([
    ["git", "fetch", "origin", "stack/node-first"],
    ["git", "rev-parse", "HEAD", "origin/stack/node-first"],
  ]);
});
test("an exact remote head commits only the public book after fetching", async () => {
  const { step, calls, store } = setup("same", "same");
  await step.apply();
  expect(calls[0]).toEqual(["git", "fetch", "origin", "stack/node-first"]);
  expect(calls.find((args) => args[1] === "add")).toEqual(["git", "add", "--", "contracts/common/addresses/dev.json"]);
  expect(calls.find((args) => args[1] === "commit")!.slice(-2)).toEqual(["--", "contracts/common/addresses/dev.json"]);
  expect(calls.find((args) => args[1] === "push")).toEqual(["git", "push", "origin", "HEAD:stack/node-first"]);
  expect(store.read<{ number: number }>("pull-request.json")).toEqual({ number: 5039 });
});
