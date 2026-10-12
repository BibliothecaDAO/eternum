import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as processTools from "./process";
import { deployShard, artifactsReady, artifactFiles } from "./box";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrivateStore } from "./private-store";
import { PublicError } from "./dates";
import { environments } from "./settings";

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
