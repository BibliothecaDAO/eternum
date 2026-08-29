import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mergeEnvironmentFile } from "./files.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })));
});

async function createTemporaryEnvironmentFile(content) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "eternum-env-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, ".env");
  await fs.writeFile(filePath, content);
  return filePath;
}

describe("mergeEnvironmentFile", () => {
  test("updates public addresses without disturbing comments or unrelated values", async () => {
    const filePath = await createTemporaryEnvironmentFile("# private\nSECRET=keep\nexport LEDGER_ADDRESS=old\n");

    await mergeEnvironmentFile(filePath, {
      LEDGER_ADDRESS: "0x123",
      MMR_TOKEN_ADDRESS: "0x456",
    });

    expect(await fs.readFile(filePath, "utf8")).toBe(
      "# private\nSECRET=keep\nLEDGER_ADDRESS=0x123\nMMR_TOKEN_ADDRESS=0x456\n",
    );
  });
});
