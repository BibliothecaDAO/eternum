import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { rmSync } from "node:fs";
import * as processTools from "./process";
import { deliverySteps } from "./delivery";
import type { Deployment } from "./main";
import { environments } from "./settings";

const book = "contracts/common/addresses/dev.json";
const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function setup(branch = "first-addresses", dirty = true, staged = "") {
  const calls: string[][] = [];
  spyOn(processTools, "command").mockImplementation(async ({ argv }) => {
    calls.push(argv);
    if (argv[1] === "branch") return branch;
    if (argv[1] === "status") return dirty ? ` M ${book}` : "";
    if (argv[1] === "diff") return staged;
    return "";
  });
  const context = { target: environments.dev, environment: "dev", assets: { ledger: "0x1" } } as Deployment;
  return { calls, step: deliverySteps(context).find((step) => step.name === "Public address book commit")! };
}
test.each(["", "next"])("address book never pushes a detached checkout or next (%s)", async (branch) => {
  const { step, calls } = setup(branch);
  await expect(step.apply()).rejects.toThrow("Create a branch");
  expect(calls.some((args) => ["add", "commit", "push"].includes(args[1]!))).toBe(false);
});
test("a first book is committed alone on the owner's branch, then stops for the new revision", async () => {
  const { step, calls } = setup();
  await expect(step.apply()).rejects.toThrow("Public address book pushed. Rerun");
  expect(calls).toContainEqual(["git", "add", "--", book]);
  expect(calls.find((args) => args[1] === "commit")!.slice(-2)).toEqual(["--", book]);
  expect(calls).toContainEqual(["git", "push", "origin", "HEAD:first-addresses"]);
});
test("unrelated staged files prevent address book publication", async () => {
  const { step, calls } = setup("first-addresses", true, "package.json");
  await expect(step.apply()).rejects.toThrow("Unrelated staged changes");
  expect(calls.some((args) => args[1] === "push")).toBe(false);
});
test("an existing committed book needs no publication", async () => {
  const { step, calls } = setup("fix", false);
  expect((await step.inspect()).done).toBe(true);
  expect(calls).toEqual([["git", "status", "--porcelain", "--", book]]);
});
