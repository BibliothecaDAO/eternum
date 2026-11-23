#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { hash } from "starknet";
import { getContractArtifactPaths, readContractArtifacts } from "../../../../../scripts-runtime/js/artifacts.js";
import { loadJsonConfigFile } from "../../../../../scripts-runtime/js/config.js";
import { loadNetworkEnvironment } from "../../../../../scripts-runtime/js/environment.js";
import {
  declareContract,
  deployContract,
  executeContractCalls,
  getProvider,
} from "../../../../../scripts-runtime/js/starknet.js";
import { assertLedgerRpc } from "../ledger-rpc.js";
import { buildRacePlan } from "./race-plan.js";
import { raceSteps } from "./race-steps.js";

const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(commandDirectory, "..", "..", "..", "..", "..", "..");
const ledgerPackage = path.join(repoRoot, "contracts", "l2", "ledger");

await runRaceStep();

async function runRaceStep() {
  const { values: options, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      addresses: { type: "string" },
      shard: { type: "string" },
      game: { type: "string" },
      amount: { type: "string" },
      execute: { type: "boolean", default: false },
    },
  });
  if (!["dev", "production"].includes(options.addresses)) throw new Error("--addresses is dev or production");
  loadNetworkEnvironment(
    path.join(repoRoot, "contracts", "common", ".env.mainnet"),
    "mainnet",
    path.join(repoRoot, ".env"),
  );
  await assertLedgerRpc();
  const plan = buildRacePlan({
    step: positionals[0],
    book: options.addresses,
    addresses: loadJsonConfigFile(addressBookPath(options.addresses)),
    environment: process.env,
    options,
  });
  await raceSteps(await mainnetPorts(options.addresses))[plan.step](plan, options.execute);
}

async function mainnetPorts(book) {
  return {
    provider: await getProvider(),
    account: {
      declare: (signer) =>
        declareContract({ accountAddress: signer, artifactPaths: rewardsArtifacts(), label: "RaceRewards" }),
      deploy: ({ classHash, constructorCalldata, signer }) =>
        deployContract({ accountAddress: signer, classHash, constructorCalldata, label: "RaceRewards" }),
      execute: (signer, calls) => executeContractCalls({ accountAddress: signer, calls, label: "race funding" }),
    },
    builtClassHash,
    addressBook: addressBookPath(book),
    readRelayReceipt,
    log,
  };
}

function builtClassHash() {
  const result = spawnSync("scarb", ["--release", "build"], { cwd: ledgerPackage, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`RaceRewards build failed with exit code ${result.status}`);
  return hash.computeContractClassHash(readContractArtifacts(rewardsArtifacts()).contract);
}

function rewardsArtifacts() {
  return getContractArtifactPaths(path.join(ledgerPackage, "target", "release"), "game_ledger", "RaceRewards");
}

async function readRelayReceipt(plan) {
  const relay = process.env.VALUE_RELAY_URL?.trim();
  if (!relay) throw new Error("VALUE_RELAY_URL is required (the game's origin, which serves /api/value)");
  const url = new URL("/api/value/race-receipt", relay);
  url.search = new URLSearchParams({ chainId: plan.shard, gameId: String(plan.game) }).toString();
  const response = await fetch(url, { redirect: "manual" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The relay answered ${response.status} for the race receipt`);
  return response.json();
}

function addressBookPath(book) {
  return path.join(repoRoot, "contracts", "common", "addresses", `${book}.json`);
}

function log(event, fields) {
  console.info(JSON.stringify({ event, ...fields }, (_, value) => (typeof value === "bigint" ? `${value}` : value)));
}
