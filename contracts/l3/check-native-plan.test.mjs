import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const sectionsOf = (config) => {
  const parts = config.split(/^\[([^\]]+)\]$/m);
  const sections = {};
  for (let index = 1; index < parts.length; index += 2) sections[parts[index]] = parts[index + 1];
  return sections;
};

/** What a malformed native mapping breaks: a gate kind outside the landing list, a kind off the native gate, a stage run twice or never. */
const planProblem = (plan, config) => {
  const stages = plan.match(/for stage in (.+); do/)[1].split(" ");
  const sections = sectionsOf(config);
  const kinds = sections.gate.match(/^kinds = "([^"]+)"/m)[1].split(" ");
  const landing = sections.land.match(/^kinds = "([^"]+)"/m)[1].split(" ");
  for (const kind of kinds) if (!landing.includes(kind)) return `The landing gate omits ${kind}`;
  const actual = [];
  for (const kind of kinds) {
    const command = sections[`kind.${kind}`]?.match(/^cmd = "([^"]+)"/m)?.[1];
    if (!/^bash contracts\/l3\/check-native\.sh \S+$/.test(command ?? "")) return `${kind} must use the native gate`;
    actual.push(command.split(" ").at(-1));
  }
  return JSON.stringify(actual.toSorted()) === JSON.stringify(stages.toSorted())
    ? null
    : `the gate runs ${actual.toSorted()} but the plan has ${stages.toSorted()}`;
};

/** The kinds a landing selects for a changed file, as the landing's paths say (a leading ! excludes). */
const selectedBy = (config, file) => {
  const sections = sectionsOf(config);
  return sections.land
    .match(/^kinds = "([^"]+)"/m)[1]
    .split(" ")
    .filter((kind) => {
      const paths = sections[`kind.${kind}`]?.match(/^paths = "([^"]+)"/m)?.[1].split(" ") ?? [];
      return (
        paths.some((path) => !path.startsWith("!") && file.startsWith(path)) &&
        !paths.some((path) => path.startsWith("!") && file.startsWith(path.slice(1)))
      );
    });
};

const plan = readFileSync(new URL("contracts/l3/check-native-plan.sh", root), "utf8");
const config = readFileSync(new URL("flow.toml", root), "utf8");

test("the service's full gate executes every native stage exactly once", () => {
  assert.equal(planProblem(plan, config), null);
});

test("a malformed native mapping is refused", () => {
  const swapped = config.replace('cmd = "bash contracts/l3/check-native.sh world"', 'cmd = "bash contracts/l3/check-native.sh test-world"');
  assert.notEqual(swapped, config);
  assert.match(planProblem(plan, swapped), /the gate runs/);
  const dropped = config.replace(/^(\[land\]\nkinds = ".*?) gate-world/m, "$1");
  assert.notEqual(dropped, config);
  assert.equal(planProblem(plan, dropped), "The landing gate omits gate-world");
});

test("an edit of flow.toml selects the cheap plan check and no Cairo suite", () => {
  assert.deepEqual(selectedBy(config, "flow.toml"), ["test-native-plan"]);
});

test("a contract change still selects every Cairo kind", () => {
  const selected = selectedBy(config, "contracts/l3/world-native/src/deep.cairo");
  for (const kind of ["sizes", "gate-prelude", "gate-vrf", "gate-world", "gate-events", "gate-drift", "test-world"])
    assert.ok(selected.includes(kind), `a contract change must select ${kind}`);
});

test("the native runner selects one package and retains its worker limit", () => {
  const directory = mkdtempSync(join(tmpdir(), "native-gate-"));
  try {
    const runner = join(directory, "runner");
    writeFileSync(runner, '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    writeFileSync(join(directory, "python3"), `#!/bin/sh\nprintf '%s\\n' '${runner}'\n`, { mode: 0o755 });
    const run = (args) =>
      spawnSync("bash", ["contracts/l3/test-native.sh", ...args], {
        cwd: root,
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
        encoding: "utf8",
      });
    for (const [args, packageName, threads] of [
      [[], "world_tests_*", "1"],
      [["--package", "world_tests_discovery"], "world_tests_discovery", "1"],
      [["--package", "world_tests_discovery_roots"], "world_tests_discovery_roots", "4"],
    ]) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.stdout.trim().split("\n"), ["test", "--package", packageName, "--max-threads", threads]);
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

test("every native gate script exists in the committed tree", () => {
  const gate = readFileSync(new URL("contracts/l3/check-native.sh", root), "utf8");
  const directories = { world: "world-native", verifier: "vrf-verifier", account: "player-account" };
  const scripts = [...gate.matchAll(/"\$(world|verifier|account)\/([^"\n]+\.(?:mjs|py|sh|ts))"/g)];
  assert.ok(scripts.length > 0, "The gate must invoke its script checks");
  for (const [, directory, script] of scripts) {
    const path = `contracts/l3/${directories[directory]}/${script}`;
    assert.ok(existsSync(new URL(path, root)), `Native gate references a missing script: ${path}`);
  }
});
