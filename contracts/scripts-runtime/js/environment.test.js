import { afterEach, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadNetworkEnvironment } from "./environment.js";

const directories = [];

/** A committed network file and the repo-root secret file beside it, as a contract task reads them. */
function environmentFiles(network, secret) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "contract-env-"));
  directories.push(directory);
  const networkFile = path.join(directory, ".env.mainnet");
  const secretFile = path.join(directory, ".env");
  fs.writeFileSync(networkFile, network);
  fs.writeFileSync(secretFile, secret);
  return { networkFile, secretFile };
}

afterEach(() => {
  for (const key of ["TEST_DEPLOYMENT_SECRET", "STARKNET_RPC", "STARKNET_NETWORK"]) delete process.env[key];
  for (const directory of directories.splice(0)) fs.rmSync(directory, { force: true, recursive: true });
});

test("root secrets override public network defaults", () => {
  const { networkFile, secretFile } = environmentFiles(
    "TEST_DEPLOYMENT_SECRET=public-placeholder\n",
    "TEST_DEPLOYMENT_SECRET=root-secret\nSTARKNET_RPC=https://rpc.example/keyed\n",
  );

  loadNetworkEnvironment(networkFile, "mainnet", secretFile);

  expect(process.env.TEST_DEPLOYMENT_SECRET).toBe("root-secret");
  expect(process.env.STARKNET_NETWORK).toBe("mainnet");
});

test("refuses a network with no RPC, naming where to set one", () => {
  const { networkFile, secretFile } = environmentFiles("STARKNET_NETWORK=mainnet\n", "");

  expect(() => loadNetworkEnvironment(networkFile, "mainnet", secretFile)).toThrow(
    "STARKNET_RPC is required for mainnet",
  );
});
