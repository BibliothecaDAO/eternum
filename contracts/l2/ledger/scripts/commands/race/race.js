#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Contract, hash } from "starknet";
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
import { assertLedgerTreasury, buildRacePlan, withRaceRewards } from "./race-plan.js";

const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(commandDirectory, "..", "..", "..", "..", "..", "..");
const ledgerPackage = path.join(repoRoot, "contracts", "l2", "ledger");
const STEPS = { declare: declareRewardsClass, deploy: deployRewards, fund: fundRace, status: printRaceStatus };

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
  await STEPS[plan.step](plan, await getProvider(), options.execute);
}

async function declareRewardsClass(plan, provider, execute) {
  const classHash = builtClassHash();
  const declared = await isDeclared(provider, classHash);
  if (!execute || declared) return log("race_declare_checked", { classHash, declared, signer: plan.signer });
  await declareContract({ accountAddress: plan.signer, artifactPaths: rewardsArtifacts(), label: "RaceRewards" });
  log("race_declare_complete", { classHash });
}

async function deployRewards(plan, provider, execute) {
  assertLedgerTreasury(plan, await provider.getStorageAt(plan.ledger, hash.getSelectorFromName("treasury")));
  if (plan.rewards) {
    await assertRewardsBoundToLedger(provider, plan, plan.rewards);
    return log("race_deploy_checked", { deployed: true, rewards: plan.rewards });
  }
  const classHash = builtClassHash();
  const transaction = { classHash, constructorCalldata: plan.constructorCalldata, signer: plan.signer };
  if (!(await isDeclared(provider, classHash)))
    throw new Error(`Class ${classHash} is not declared: run declare first`);
  if (!execute) return log("race_deploy_checked", { deployed: false, transaction });
  const rewards = await deployContract({ ...transaction, accountAddress: plan.signer, label: "RaceRewards" });
  await assertRewardsBoundToLedger(provider, plan, rewards);
  writeRewardsAddress(plan.book, rewards);
  log("race_deploy_complete", { rewards, addresses: `contracts/common/addresses/${plan.book}.json` });
}

async function fundRace(plan, provider, execute) {
  const race = await readRace(provider, plan);
  if (race.funded) return log("race_fund_checked", { funded: true, race });
  await assertLedgerAdmin(provider, plan);
  await assertLordsBalance(provider, plan);
  if (!execute) return log("race_fund_checked", { funded: false, signer: plan.signer, transaction: plan.calls });
  await executeContractCalls({ accountAddress: plan.signer, calls: plan.calls, label: "race funding" });
  log("race_fund_complete", { race: await readRace(provider, plan) });
}

async function printRaceStatus(plan, provider) {
  log("race_status", { race: await readRace(provider, plan), receipt: await readRelayReceipt(plan) });
}

function builtClassHash() {
  const result = spawnSync("scarb", ["--release", "build"], { cwd: ledgerPackage, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`RaceRewards build failed with exit code ${result.status}`);
  return hash.computeContractClassHash(readContractArtifacts(rewardsArtifacts()).contract);
}

function rewardsArtifacts() {
  return getContractArtifactPaths(path.join(ledgerPackage, "target", "release"), "game_ledger", "RaceRewards");
}

async function isDeclared(provider, classHash) {
  try {
    await provider.getClassByHash(classHash);
    return true;
  } catch (error) {
    if (/class hash not found|CLASS_HASH_NOT_FOUND/i.test(String(error?.message))) return false;
    throw error;
  }
}

async function assertRewardsBoundToLedger(provider, plan, rewards) {
  for (const [entrypoint, expected] of [
    ["ledger", plan.ledger],
    ["treasury", plan.treasury],
  ]) {
    const [actual] = await provider.callContract({ contractAddress: rewards, entrypoint, calldata: [] }, "latest");
    if (BigInt(actual) !== BigInt(expected))
      throw new Error(`Race rewards ${rewards} answers ${entrypoint} ${actual}, expected ${expected}`);
  }
}

async function assertLedgerAdmin(provider, plan) {
  const [held] = await provider.callContract(
    { contractAddress: plan.ledger, entrypoint: "has_role", calldata: ["0x0", plan.signer] },
    "latest",
  );
  if (BigInt(held) !== 1n) throw new Error(`${plan.signer} does not hold DEFAULT_ADMIN_ROLE on ${plan.ledger}`);
}

async function assertLordsBalance(provider, plan) {
  const [low, high] = await provider.callContract(
    { contractAddress: plan.lords, entrypoint: "balance_of", calldata: [plan.signer] },
    "latest",
  );
  const [, amountLow, amountHigh] = plan.calls[0].calldata;
  if (BigInt(low) + (BigInt(high) << 128n) < BigInt(amountLow) + (BigInt(amountHigh) << 128n))
    throw new Error(`${plan.signer} holds fewer LORDS than the funding`);
}

async function readRace(provider, plan) {
  const { abi } = await provider.getClassAt(plan.rewards);
  const rewards = new Contract({ abi, address: plan.rewards, providerOrAccount: provider });
  return rewards.get_race(plan.shard, plan.game);
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

function writeRewardsAddress(book, rewards) {
  const file = addressBookPath(book);
  fs.writeFileSync(file, `${JSON.stringify(withRaceRewards(loadJsonConfigFile(file), rewards), null, 2)}\n`);
}

function addressBookPath(book) {
  return path.join(repoRoot, "contracts", "common", "addresses", `${book}.json`);
}

function log(event, fields) {
  console.info(JSON.stringify({ event, ...fields }, (_, value) => (typeof value === "bigint" ? `${value}` : value)));
}
