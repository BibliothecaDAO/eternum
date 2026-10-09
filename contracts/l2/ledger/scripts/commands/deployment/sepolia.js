#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CallData, byteArray, hash, shortString, uint256 } from "starknet";
import { getContractArtifactPaths, readContractArtifacts } from "../../../../../scripts-runtime/js/artifacts.js";
import { getAccount } from "../../../../../scripts-runtime/js/starknet.js";
import { buildLedgerEconomicPreset } from "../../../../../../config/deployer/clean/ledger/economics.ts";
import { buildMysteryChestPreset } from "../../chest-preset.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const l2Root = path.dirname(packageRoot);
const manifestPath = path.join(packageRoot, "target", "sepolia-deployment.json");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadSettings() {
  const settings = {
    address: required("SEPOLIA_ACCOUNT_ADDRESS"),
    privateKey: required("SEPOLIA_ACCOUNT_PRIVATE_KEY"),
    operator: required("SEPOLIA_OPERATOR_ADDRESS"),
    pauser: required("SEPOLIA_PAUSER_ADDRESS"),
    shard: required("SEPOLIA_SHARD_CHAIN_ID"),
    seed: required("SEPOLIA_GAME_SEED"),
    start: BigInt(required("SEPOLIA_SEASON_START")),
    end: BigInt(required("SEPOLIA_SEASON_END")),
    pool: BigInt(required("SEPOLIA_FRONTIER_POOL_WEI")),
    chestCids: [1, 2, 3, 4, 5].map((band) => required(`SEPOLIA_CHEST_BAND_${band}_CID`)),
    cosmeticCid: required("SEPOLIA_COSMETIC_CID"),
    // Paid-entry demonstrations do not invoke the pass contracts.
    seasonPass: required("SEPOLIA_SEASON_PASS_ADDRESS"),
    villagePass: required("SEPOLIA_VILLAGE_PASS_ADDRESS"),
  };
  for (const name of ["address", "operator", "pauser", "seasonPass", "villagePass", "shard"]) {
    if (BigInt(settings[name]) <= 0n) throw new Error(`Invalid ${name}`);
  }
  if (settings.start >= settings.end || settings.pool <= 0n || settings.pool >= 1n << 128n) {
    throw new Error("Invalid season window or pool");
  }
  return settings;
}

async function confirm(account, transactionHash) {
  const receipt = await account.waitForTransaction(transactionHash);
  if (receipt.execution_status !== "SUCCEEDED") throw new Error("Transaction reverted");
  return transactionHash;
}

async function deployAsset(account, packageName, artifactName, constructorCalldata) {
  const artifactPaths = getContractArtifactPaths(
    path.join(l2Root, packageName, "target", "release"),
    packageName === "ledger" ? "game_ledger" : packageName,
    artifactName,
  );
  const artifacts = readContractArtifacts(artifactPaths);
  const declaration = await account.declareIfNot({ contract: artifacts.contract, casm: artifacts.casm });
  if (declaration.transaction_hash) await confirm(account, declaration.transaction_hash);
  const deployment = await account.deployContract({ classHash: declaration.class_hash, constructorCalldata });
  await confirm(account, deployment.transaction_hash);
  console.log(JSON.stringify({ step: "deployed", artifact: artifactName, address: deployment.address }));
  return deployment.address;
}

function collectibleConstructor(name, admin) {
  return CallData.compile([
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString("TEST"),
    byteArray.byteArrayFromString(""),
    byteArray.byteArrayFromString("Sepolia test collection"),
    admin,
    admin,
    admin,
    admin,
    admin,
    admin,
    0,
  ]);
}

async function deployAssets(account, settings) {
  const lords = await deployAsset(account, "ledger", "TestLords", []);
  const mmr = await deployAsset(account, "mmr", "MMRToken", [settings.address, settings.address]);
  const chests = await deployAsset(
    account,
    "collectibles",
    "RealmsCollectible",
    collectibleConstructor("Test Blitz Chests", settings.address),
  );
  const cosmetics = await deployAsset(
    account,
    "collectibles",
    "RealmsCollectible",
    collectibleConstructor("Test Cosmetics", settings.address),
  );
  const ledger = await deployAsset(account, "ledger", "GameLedger", [
    settings.address,
    settings.operator,
    settings.address,
    lords,
    mmr,
    settings.seasonPass,
    settings.villagePass,
    chests,
    cosmetics,
  ]);
  return { ledger, lords, mmr, chests, cosmetics };
}

function buildPreset() {
  // This rehearsal funds Frontier alongside Blitz rewards using the shard's configured day unit.
  return {
    ...buildLedgerEconomicPreset("blitz"),
    day_unit_seconds: buildLedgerEconomicPreset("frontier").day_unit_seconds,
    season_bags: buildLedgerEconomicPreset("frontier").season_bags,
  };
}

function buildSetupCalls(assets, settings, preset) {
  const call = (contractAddress, entrypoint, args) => ({
    contractAddress,
    entrypoint,
    calldata: CallData.compile(args),
  });
  const chestPreset = buildMysteryChestPreset();
  const cosmeticMetadata = byteArray.byteArrayFromString(settings.cosmeticCid);
  return [
    call(assets.mmr, "grant_role", [hash.getSelectorFromName("UPDATER_ROLE"), assets.ledger]),
    call(assets.chests, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.cosmetics, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.ledger, "grant_role", [hash.getSelectorFromName("PAUSER_ROLE"), settings.pauser]),
    ...chestPreset.bands.map((band, index) =>
      call(assets.chests, "set_attrs_raw_to_ipfs_cid", [
        band.metadata,
        byteArray.byteArrayFromString(settings.chestCids[index]),
        false,
      ]),
    ),
    ...chestPreset.items.flatMap((items) =>
      items.map((item) => call(assets.cosmetics, "set_attrs_raw_to_ipfs_cid", [item, cosmeticMetadata, false])),
    ),
    call(assets.lords, "mint", [settings.address, uint256.bnToUint256(settings.pool)]),
    call(assets.lords, "approve", [assets.ledger, uint256.bnToUint256(settings.pool)]),
    call(assets.ledger, "register_preset", [1, preset, chestPreset.bands, chestPreset.items]),
    call(assets.ledger, "open_season", [1, 1, settings.start, settings.end]),
    call(assets.ledger, "fund_frontier", [settings.shard, 1, settings.seed, uint256.bnToUint256(settings.pool)]),
  ];
}

async function main() {
  process.env.STARKNET_NETWORK = "sepolia";
  process.env.STARKNET_RPC = required("SEPOLIA_RPC_URL");
  const settings = loadSettings();
  const account = await getAccount({ accountAddress: settings.address, privateKey: settings.privateKey });
  const chainId = await account.getChainId();
  if (BigInt(chainId) !== BigInt(shortString.encodeShortString("SN_SEPOLIA"))) throw new Error("Sepolia required");
  const latest = await account.getBlock("latest");
  if (settings.start <= BigInt(latest.timestamp)) throw new Error("Season start must be in the future");
  const assets = await deployAssets(account, settings);
  const preset = buildPreset();
  const setup = await account.execute(buildSetupCalls(assets, settings, preset));
  await confirm(account, setup.transaction_hash);
  const manifest = {
    chainId,
    ...assets,
    shard: settings.shard,
    seasonId: 1,
    presetId: 1,
    start: settings.start.toString(),
    end: settings.end.toString(),
    frontierPoolWei: settings.pool.toString(),
    setupTransaction: setup.transaction_hash,
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ step: "ready", manifest: manifestPath, ...manifest }));
}

main().catch(() => {
  // SDK error objects may include signer configuration; only public status is printed.
  console.error("Sepolia deployment failed; check required settings, artifacts and transaction receipts.");
  process.exitCode = 1;
});
