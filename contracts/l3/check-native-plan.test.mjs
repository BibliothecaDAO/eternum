import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("the service's full gate executes every native stage exactly once", () => {
  const plan = readFileSync(new URL("contracts/l3/check-native-plan.sh", root), "utf8");
  const stages = plan.match(/for stage in (.+); do/)[1].split(" ");
  const config = readFileSync(new URL("flow.toml", root), "utf8");
  const parts = config.split(/^\[([^\]]+)\]$/m);
  const sections = {};
  for (let index = 1; index < parts.length; index += 2) sections[parts[index]] = parts[index + 1];
  const kinds = sections.gate.match(/^kinds = "([^"]+)"/m)[1].split(" ");
  const actual = kinds.map((kind) => {
    const command = sections[`kind.${kind}`]?.match(/^cmd = "([^"]+)"/m)?.[1];
    assert.match(command, /^bash contracts\/l3\/check-native\.sh \S+$/, `${kind} must use the native gate`);
    return command.split(" ").at(-1);
  });
  assert.deepEqual(actual.toSorted(), stages.toSorted());
});

test("the native runner selects one package and retains its worker limit", () => {
  const directory = mkdtempSync(join(tmpdir(), "native-gate-"));
  try {
    const runner = join(directory, "runner");
    writeFileSync(runner, '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    writeFileSync(join(directory, "python3"), `#!/bin/sh\nprintf '%s\\n' '${runner}'\n`, { mode: 0o755 });
    const run = (args) => spawnSync("bash", ["contracts/l3/test-native.sh", ...args], {
      cwd: root,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      encoding: "utf8",
    });
    for (const [args, packageName] of [[[], "world_tests_*"], [["--package", "world_tests_discovery*"], "world_tests_discovery*"]]) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.stdout.trim().split("\n"), ["test", "--package", packageName, "--max-threads", "1"]);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an unknown stage refuses without running any checks", () => {
  const result = spawnSync("bash", ["contracts/l3/check-native.sh", "missing-stage"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown native gate stage: missing-stage/);
});
