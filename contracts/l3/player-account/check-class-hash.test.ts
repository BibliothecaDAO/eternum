import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAccountClass } from "./check-class-hash";

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
const fixtureHash = "0x47038ae154cef1a8113af3156b8977c6f419df613c1971ed0cf29b3094b9586";
function artifact(program = ["0x1"]) {
  const directory = mkdtempSync(join(tmpdir(), "account-class-check-"));
  directories.push(directory);
  const path = join(directory, "account.contract_class.json");
  writeFileSync(
    path,
    JSON.stringify({
      contract_class_version: "0.1.0",
      sierra_program: program,
      entry_points_by_type: { EXTERNAL: [], L1_HANDLER: [], CONSTRUCTOR: [] },
      abi: "[]",
    }),
  );
  return path;
}

test("the matching built class passes, independently of felt padding", () => {
  expect(() => checkAccountClass(artifact(), `0x0${fixtureHash.slice(2)}`)).not.toThrow();
});
test("a changed compiled account refuses the stale service pin", () => {
  expect(() => checkAccountClass(artifact(["0x2"]), fixtureHash)).toThrow("Player account class differs: built");
});
test("a missing compiled account fails instead of skipping", () => {
  const path = artifact();
  rmSync(path);
  expect(() => checkAccountClass(path, fixtureHash)).toThrow("ENOENT");
});
test("malformed artifacts fail instead of supplying a default hash", () => {
  const path = artifact();
  writeFileSync(path, "{}");
  expect(() => checkAccountClass(path, fixtureHash)).toThrow();
});
