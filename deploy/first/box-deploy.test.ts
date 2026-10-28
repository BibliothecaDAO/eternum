import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as failureTools from "./errors";
import * as processTools from "./process";
import { deployShard, artifactsReady, artifactFiles, operatorTokenMatches, valueSources } from "./box";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  statSync,
  readdirSync,
  readlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { PrivateStore } from "./private-store";
import { PublicError } from "./errors";
import { environments, root } from "./settings";

afterEach(() => mock.restore());

test("the laptop exposes the box's filtered Docker refusal as a public error", async () => {
  const message =
    "Shard deployment stopped at start Herald. failed to create network: all predefined address pools have been fully subnetted";
  spyOn(processTools, "command").mockRejectedValue(
    new processTools.CommandFailure(JSON.stringify({ kind: "shard-deployment-refused", message })),
  );
  const error = await deployShard(environments.dev, "a".repeat(40), () => {}).catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toBe(message);
});

test.each(["private output", JSON.stringify({ message: "private output" })])(
  "unstructured remote failures stay private",
  async (stdout) => {
    spyOn(processTools, "command").mockRejectedValue(new processTools.CommandFailure(stdout));
    await expect(deployShard(environments.dev, "a".repeat(40), () => {})).rejects.toThrow(
      "Deployment subprocess failed; no captured output was printed",
    );
  },
);

test("command captures failed stdout for the structured boundary without adding it to the error message", async () => {
  const error = await processTools
    .command({ argv: [process.execPath, "-e", 'process.stdout.write("fixture-output"); process.exit(1)'] })
    .catch((error) => error);
  expect(error).toBeInstanceOf(processTools.CommandFailure);
  expect(error.stdout).toBe("fixture-output");
  expect(error.message).not.toContain("fixture-output");
  if (error.log) rmSync(join(error.log, ".."), { recursive: true });
});

test("a service-only revision reuses the existing value artifacts; changed source or missing files rebuild", async () => {
  const directory = mkdtempSync(join(tmpdir(), "artifact-cache-"));
  try {
    mkdirSync(join(directory, "artifacts"));
    for (const { file } of artifactFiles) writeFileSync(join(directory, "artifacts", file), "{}");
    const store = { directory, read: () => ({ revision: "a".repeat(40) }) } as unknown as PrivateStore;
    const diff = spyOn(processTools, "command").mockResolvedValue("");
    expect(await artifactsReady(store, "b".repeat(40))).toBe(true);
    expect(diff.mock.calls[0]![0].argv).toContain("contracts/l2/collectibles");
    diff.mockResolvedValue("contracts/l2/ledger/src/lib.cairo");
    expect(await artifactsReady(store, "b".repeat(40))).toBe(false);
    rmSync(join(directory, "artifacts", artifactFiles[0]!.file));
    expect(await artifactsReady(store, "a".repeat(40))).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failed command logs keep stderr and redact credential input and environment", async () => {
  const error = await processTools
    .command({
      argv: [
        process.execPath,
        "-e",
        'process.stdin.resume(); process.stdin.on("data", data => process.stderr.write(data)); process.stdin.on("end", () => { process.stderr.write(process.env.OPERATOR_TOKEN); process.exit(1); });',
      ],
      input: JSON.stringify({ PRIVATE_KEY: "fixture-input-credential" }),
      env: { OPERATOR_TOKEN: "fixture-environment-credential" },
    })
    .catch((error) => error);
  expect(error).toBeInstanceOf(processTools.CommandFailure);
  const log = readFileSync(error.log, "utf8");
  expect(log).not.toContain("fixture-input-credential");
  expect(log).not.toContain("fixture-environment-credential");
  expect(log).toContain("[redacted]");
  expect(statSync(error.log).mode & 0o777).toBe(0o600);
  rmSync(join(error.log, ".."), { recursive: true });
});

test("operator comparison sends the supplied credential only on stdin and returns no box credential", async () => {
  const execute = spyOn(processTools, "command").mockResolvedValue("match\n");
  expect(await operatorTokenMatches(environments.dev, "fixture-supplied-credential")).toBe(true);
  const spec = execute.mock.calls[0]![0];
  expect(spec.input).toBe("fixture-supplied-credential");
  expect(spec.argv.join(" ")).not.toContain("fixture-supplied-credential");
  expect(spec.argv.join(" ")).toContain("compare_digest");
  execute.mockResolvedValue("different\n");
  expect(await operatorTokenMatches(environments.dev, "fixture-supplied-credential")).toBe(false);
});

test("a log storage failure cannot escape the subprocess rejection handler", async () => {
  spyOn(failureTools, "failureLog").mockReturnValue(undefined);
  const error = await processTools
    .command({ argv: [process.execPath, "-e", "process.exit(2)"] })
    .catch((error) => error);
  expect(error).toBeInstanceOf(processTools.CommandFailure);
  expect(error.log).toBeUndefined();
  expect(error.name).toBe("command_failed");
});

test("a plain refusal prints its full diagnostic without making a temporary log directory", async () => {
  const directory = mkdtempSync(join(tmpdir(), "plain-refusal-"));
  try {
    const script = `
      import { reportFailure, PublicError } from ${JSON.stringify(join(import.meta.dir, "errors.ts"))};
      reportFailure(new PublicError("Run setup before opening a season", null, "precondition_failed", "setup"));
    `;
    const child = Bun.spawn([process.execPath, "--no-env-file", "-e", script], {
      env: { ...process.env, TMPDIR: directory },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, output] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(code).toBe(1);
    expect(output.trim()).toBe(
      "Deployment stopped at setup; HTTP n/a; code precondition_failed: Run setup before opening a season",
    );
    expect(readdirSync(directory)).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the value build copies every source its packages link to, and a change to one rebuilds the artifacts", () => {
  const listed = Bun.spawnSync(
    ["git", "ls-files", "-s", "contracts/l2/ledger", "contracts/l2/mmr", "contracts/l2/collectibles"],
    { cwd: root },
  );
  const links = listed.stdout
    .toString()
    .split("\n")
    .filter((line) => line.startsWith("120000 "))
    .map((line) => line.split("\t")[1]!);
  const targets = links.map((link) => relative(root, resolve(root, dirname(link), readlinkSync(join(root, link)))));
  expect(targets.length).toBeGreaterThan(0);
  const dockerfile = readFileSync(join(root, "deploy/shard/Dockerfile"), "utf8");
  const stage = dockerfile.slice(dockerfile.indexOf("AS value-contracts"));
  for (const target of targets) {
    expect(target.startsWith("contracts/l2/")).toBe(false);
    expect(valueSources).toContain(target);
    expect(stage).toContain(`COPY ${target} ${target}`);
  }
});
