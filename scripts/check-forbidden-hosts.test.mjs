import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-forbidden-hosts.mjs", import.meta.url));
const vendorHost = ["cartridge", "gg"].join(".");
const vendorScope = "@" + "cartridge";

function checkFixture(files) {
  const cwd = mkdtempSync(join(tmpdir(), "eternum-host-policy-"));
  try {
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd }).status, 0);
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), contents);
    }
    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("identity SDK patches share the existing dependency exception", () => {
  const result = checkFixture({
    [`patches/${vendorScope}__controller@0.13.16.patch`]: `+const host = "${vendorHost}";`,
    "package.json": JSON.stringify({ dependencies: { [`${vendorScope}/controller`]: "0.13.16" } }),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test("first-party endpoints and unrelated patches/dependencies stay prohibited", () => {
  const result = checkFixture({
    "apps/game/src/identity.ts": `const host = "${vendorHost}";`,
    "patches/unrelated@1.0.0.patch": `+const host = "${vendorHost}";`,
    [`patches/${vendorScope}__controller-extra@1.0.0.patch`]: `+const host = "${vendorHost}";`,
    "package.json": JSON.stringify({ dependencies: { [`${vendorScope}/other-sdk`]: "1.0.0" } }),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map(({ path, rule }) => ({ path, rule })).sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "apps/game/src/identity.ts", rule: "forbidden-host" },
      { path: "package.json", rule: "forbidden-dependency" },
      { path: `patches/${vendorScope}__controller-extra@1.0.0.patch`, rule: "forbidden-host" },
      { path: "patches/unrelated@1.0.0.patch", rule: "forbidden-host" },
    ].sort((a, b) => a.path.localeCompare(b.path)),
  );
});
