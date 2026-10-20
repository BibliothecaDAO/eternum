import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { proveIcons, proveResourceIcons } from "./prove.mjs";
import { problemsOf } from "../../apps/game/scripts/prove-run.mjs";

for (const failure of [null, "decode", "mapping", "navigation", "chip size"]) {
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
            if (failure === "chip size" && expression.includes("rect.width===28")) return false;
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
      assert.equal(problems.length, failure === "chip size" ? 2 : failure ? 10 : 0);
      if (!failure) {
        assert.equal(records.flatMap((r) => r.checks).filter((c) => c.ok).length, 32);
        assert.ok(records.flatMap((r) => r.presses).every((p) => p.status === "led"));
      }
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
}

for (const failure of [null, "old artwork", "missing digest"]) {
  test(`app proof collector ${failure ? `rejects ${failure}` : "accepts approved Ivory delivery"}`, async () => {
    const out = await mkdtemp(join(tmpdir(), "app-icon-proof-"));
    try {
      const records = [];
      const { createHash } = await import("node:crypto");
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(new URL("../../apps/game/public/icons/facets/64/play.webp", import.meta.url));
      const sha256 =
        failure === "missing digest"
          ? undefined
          : failure === "old artwork"
            ? "old"
            : createHash("sha256").update(bytes).digest("hex");
      const url = "/icons/facets/64/play.webp";
      await proveIcons(
        {
          run() {},
          evaluate() {
            return {
              overflow: false,
              icons: [{ meaning: "play", url, expected: url, loaded: true, utility: true, sha256 }],
            };
          },
        },
        out,
        records,
        "https://fixture.invalid",
        "desktop",
        ["play"],
      );
      assert.equal(records.length, 1);
      const problems = problemsOf(records, (record) => ({ name: record.name }));
      assert.equal(problems.length, failure ? 1 : 0);
      assert.equal(records[0].checks[1].ok, !failure);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
}
