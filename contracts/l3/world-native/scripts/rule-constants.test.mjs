import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { readRuleConstants } from "./rule-constants.mjs";

const root = new URL("../", import.meta.url);

test("sharing roster constants preserves the published rule values and their schema identity order", async () => {
  const schema = JSON.parse(await readFile(new URL("schema/schema.json", root), "utf8"));
  const rules = await readRuleConstants(root);
  assert.equal(JSON.stringify(rules), JSON.stringify(schema.ruleConstants));
  const shared = await readFile(new URL("src/roster_limits.cairo", root), "utf8");
  assert.equal(
    await realpath(new URL("src/roster_limits.cairo", root)),
    await realpath(new URL("../../l2/ledger/src/roster_limits.cairo", root)),
  );
  for (const name of ["MAX_BLITZ_ROSTER_PLAYERS", "DUEL_ROSTER_PLAYERS"]) {
    const value = shared.match(new RegExp(`^pub const ${name}: u32 = ([0-9]+);$`, "m"));
    assert.ok(value, `missing shared ${name}`);
    assert.equal(rules[name], Number(value[1]));
  }
});

test("a missing shared rule refuses schema generation instead of becoming a silent zero", async () => {
  const directory = await mkdtemp(join(tmpdir(), "roster-rule-test-"));
  try {
    await mkdir(join(directory, "src"));
    await writeFile(join(directory, "src/rules.cairo"), "pub const MAX: u32 = crate::roster_limits::MISSING;\n");
    await writeFile(join(directory, "src/roster_limits.cairo"), "pub const MAX_BLITZ_ROSTER_PLAYERS: u32 = 24;\n");
    await writeFile(join(directory, "src/days.cairo"), "pub const FRONTIER_REPORT_GRACE_SECONDS: u32 = 3600;\n");
    await assert.rejects(readRuleConstants(pathToFileURL(directory + sep)), /Unknown shared rule constant MISSING/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the withdrawal reporting grace is shared with the ledger and exported to clients", async () => {
  const rules = await readRuleConstants(root);
  assert.equal(rules.FRONTIER_REPORT_GRACE_SECONDS, 3600);
  assert.equal(
    await realpath(new URL("src/days.cairo", root)),
    await realpath(new URL("../../l2/ledger/src/days.cairo", root)),
  );
});
