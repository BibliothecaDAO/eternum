import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FLOW_DRIFT, kindName, parityProblems, validationPaths } from "./flow";
import { interpolate, root, runtimeMatches, runtimePin, selectedStep, validationJobs } from "./jobs";

const source = readFileSync(resolve(root, "flow.toml"), "utf8");
const jobs = validationJobs();
const paths = validationPaths();

test("every concrete validation job runs through its workflow with the same selection", () => {
  expect(jobs.map((job) => job.id)).toContain("runtime/offline-tests/harness");
  expect(jobs.filter((job) => job.id.startsWith("native/service-class-sizes/"))).toHaveLength(1);
  expect(parityProblems(source, jobs, paths)).toEqual([]);
});

test.each(jobs)("refuses an omitted job: $id", (job) => {
  const kind = kindName(job);
  const missing = source.replace(`[kind.${kind}]`, `[kind.retired-${kind}]`);
  expect(parityProblems(missing, jobs, paths)).toEqual([FLOW_DRIFT]);
});

test("refuses the old partial harness command and a narrower dependency scope", () => {
  const partial = source.replace(
    "bun scripts/ci/run.ts runtime/offline-tests/harness",
    "bun test deploy/athanor/harness/confirmation.test.ts",
  );
  expect(parityProblems(partial, jobs, paths)).toEqual([FLOW_DRIFT]);
  const missingRelease = source.replaceAll("deploy/release/ ", "");
  expect(parityProblems(missingRelease, jobs, paths)).toEqual([FLOW_DRIFT]);
});

test("refuses a hand-written kind below the generated marker, which --write would drop", () => {
  const appended = `${source}\n[kind.playtest-by-hand]\ncmd = "true"\n`;
  expect(parityProblems(appended, jobs, paths)).toEqual([FLOW_DRIFT]);
});

test("a new workflow job cannot inherit a passing result from an existing job", () => {
  const added = { ...jobs[0]!, id: "static/new-check" };
  expect(parityProblems(source, [...jobs, added], paths)).toEqual([FLOW_DRIFT]);
});

test("matrix conditions and expressions preserve the workflow's actual command", () => {
  expect(selectedStep({ if: "matrix.suite == 'runner'" }, { suite: "harness" })).toBe(false);
  expect(selectedStep({ if: "matrix.suite == 'harness'" }, { suite: "harness" })).toBe(true);
  expect(interpolate("${{ matrix.directory }}/Scarb.toml", { matrix: { directory: "contracts/l2/ledger" } })).toBe(
    "contracts/l2/ledger/Scarb.toml",
  );
  expect(() => selectedStep({ if: "success()" }, {})).toThrow("Unsupported validation condition");
  expect(() => interpolate("${{ matrix.missing }}", { matrix: {} })).toThrow("Unsupported expression");
});

test("runtime setup follows the workflow rather than the host runtime", () => {
  expect(runtimePin({ uses: "actions/setup-node@v4", with: { "node-version": "22" } })).toEqual({
    name: "node",
    version: "22",
  });
  expect(runtimePin({ uses: "oven-sh/setup-bun@v2", with: { "bun-version": "1.4.0" } })).toEqual({
    name: "bun",
    version: "1.4.0",
  });
  expect(runtimePin({ uses: "oven-sh/setup-bun@v2" })).toEqual({ name: "bun", version: "latest" });
  expect(() => runtimePin({ uses: "actions/setup-node@v4" })).toThrow("requires node-version");
  const pins = jobs.flatMap((job) => job.job.steps.flatMap((step) => runtimePin(step) ?? []));
  expect(pins).toContainEqual({ name: "node", version: "22" });
  expect(pins).toContainEqual({ name: "bun", version: "1.4.0" });
});

test("refuses a host binary that did not switch to the requested runtime", () => {
  expect(runtimeMatches("22", "v22.20.0")).toBe(true);
  expect(runtimeMatches("22", "v24.21.0")).toBe(false);
  expect(runtimeMatches("1.4.0", "1.4.0")).toBe(true);
  expect(runtimeMatches("1.4.0", "1.4.3")).toBe(false);
  expect(() => runtimeMatches("lts/*", "v22.20.0")).toThrow("Unsupported runtime version");
});
