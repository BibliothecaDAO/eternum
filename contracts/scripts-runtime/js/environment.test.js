import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadNetworkEnvironment } from "./environment.js";

test("root secrets override public network defaults", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "contract-env-"));
  const networkFile = path.join(directory, ".env.mainnet");
  const secretFile = path.join(directory, ".env");
  fs.writeFileSync(networkFile, "TEST_DEPLOYMENT_SECRET=public-placeholder\n");
  fs.writeFileSync(secretFile, "TEST_DEPLOYMENT_SECRET=root-secret\n");

  try {
    loadNetworkEnvironment(networkFile, "mainnet", secretFile);
    expect(process.env.TEST_DEPLOYMENT_SECRET).toBe("root-secret");
    expect(process.env.STARKNET_NETWORK).toBe("mainnet");
  } finally {
    delete process.env.TEST_DEPLOYMENT_SECRET;
    fs.rmSync(directory, { force: true, recursive: true });
  }
});
