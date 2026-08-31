#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runContractPackageTask } from "../../../../../scripts-runtime/js/contract-package.js";
import { assertLedgerRpc } from "../ledger-rpc.js";

const networkName = process.argv[2];
if (networkName !== "mainnet") {
  throw new Error("The phase-3 ledger deploy target is mainnet");
}

const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
await runContractPackageTask({
  actionName: "deploy",
  networkName,
  packageLabel: "Realms game ledger",
  packageRoot: path.join(commandDirectory, "..", "..", ".."),
  validateEnvironment: assertLedgerRpc,
});
