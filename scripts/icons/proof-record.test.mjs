import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { proveResourceIcons } from "./prove.mjs";
import { problemsOf } from "../../apps/game/scripts/prove-run.mjs";

for (const failure of [null, "decode", "mapping", "navigation"]) {
  test(`resource proof collector ${failure ? `rejects ${failure} failure` : "accepts successful tab navigation"}`, async () => {
    const out = await mkdtemp(join(tmpdir(), "icon-proof-"));
    try {
      const records = [];
      await proveResourceIcons(
        {
          run() {},
          evaluate(expression) {
            if (expression.includes("scrollHeight + 80")) return 1000;
            if (failure === "decode" && expression.includes("i.decode()")) return false;
            if (failure === "mapping" && expression.includes("const expected=")) return false;
            if (failure === "navigation" && expression.includes("aria-pressed")) return false;
            return true;
          },
        },
        out,
        records,
        "https://fixture.invalid",
      );
      assert.equal(records.length, 2);
      assert.equal(records.flatMap((r) => r.presses).length, 10);
      const problems = problemsOf(records, (r) => ({ name: r.name }));
      assert.equal(problems.length, failure ? 10 : 0);
      if (!failure) {
        assert.equal(records.flatMap((r) => r.checks).filter((c) => c.ok).length, 30);
        assert.ok(records.flatMap((r) => r.presses).every((p) => p.status === "led"));
      }
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
}
