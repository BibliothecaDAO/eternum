#!/usr/bin/env bun

import path from "node:path";
import { fileURLToPath } from "node:url";
import { CallData, byteArray, hash, shortString } from "starknet";
import { getContractArtifactPaths, readContractArtifacts } from "../../../../../scripts-runtime/js/artifacts.js";
import { mergeJsonFile, writeJsonFile } from "../../../../../scripts-runtime/js/files.js";
import { getAccount } from "../../../../../scripts-runtime/js/starknet.js";
import { buildLedgerEconomicPreset } from "../../../../../../config/deployer/clean/ledger/economics.ts";
import { buildMysteryChestPreset } from "../../chest-preset.js";
import { frontierLedgerPresetId } from "./frontier.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const l2Root = path.dirname(packageRoot);
const manifestPath = path.join(packageRoot, "target", "dev-deployment.json");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadSettings() {
  if (required("ENVIRONMENT") !== "staging") throw new Error("Dev deployment requires ENVIRONMENT=staging");
  const settings = {
    environment: "staging",
    address: required("DEV_ACCOUNT_ADDRESS"),
    privateKey: required("DEV_ACCOUNT_PRIVATE_KEY"),
    operator: required("DEV_OPERATOR_ADDRESS"),
    pauser: required("DEV_PAUSER_ADDRESS"),
    start: BigInt(required("DEV_SEASON_START")),
    end: BigInt(required("DEV_SEASON_END")),
    chestCids: [1, 2, 3, 4, 5].map((band) => required(`DEV_CHEST_BAND_${band}_CID`)),
    cosmeticCid: required("DEV_COSMETIC_CID"),
  };
  for (const name of ["address", "operator", "pauser"]) {
    if (BigInt(settings[name]) <= 0n) throw new Error(`Invalid ${name}`);
  }
  if (settings.start < 0n || settings.start >= settings.end || settings.end >= 1n << 64n) {
    throw new Error("Invalid Blitz season window");
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
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString(""),
    byteArray.byteArrayFromString("Dev test collection (no value)"),
    admin,
    admin,
    admin,
    admin,
    admin,
    admin,
    0,
  ]);
}

export async function deployAssets(account, settings, deploy = deployAsset) {
  const lords = await deploy(account, "ledger", "TestLords", []);
  const mmr = await deploy(account, "mmr", "MMRToken", [settings.address, settings.address]);
  const chests = await deploy(
    account,
    "collectibles",
    "RealmsCollectible",
    collectibleConstructor("devChest", settings.address),
  );
  const cosmetics = await deploy(
    account,
    "collectibles",
    "RealmsCollectible",
    collectibleConstructor("devCosmetics", settings.address),
  );
  const ledger = await deploy(account, "ledger", "GameLedger", [
    settings.address,
    settings.operator,
    settings.address,
    lords,
    mmr,
    chests,
    cosmetics,
  ]);
  return { ledger, lords, mmr, chests, cosmetics };
}

export function buildSetupCalls(assets, settings) {
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
    call(assets.ledger, "register_preset", [
      1,
      buildLedgerEconomicPreset("blitz"),
      chestPreset.bands,
      chestPreset.items,
    ]),
    call(assets.ledger, "register_preset", [
      frontierLedgerPresetId("dev", 5),
      buildLedgerEconomicPreset("frontier"),
      chestPreset.bands,
      chestPreset.items,
    ]),
    call(assets.ledger, "open_season", [1, 1, settings.start, settings.end]),
  ];
}

async function main() {
  process.env.STARKNET_NETWORK = "mainnet";
  const settings = loadSettings();
  process.env.STARKNET_RPC = required("DEV_RPC_URL");
  const account = await getAccount({ accountAddress: settings.address, privateKey: settings.privateKey });
  const manifest = await deployDev(account, settings, path.resolve(packageRoot, "../../.."));
  console.log(JSON.stringify({ step: "ready", manifest: manifestPath, ...manifest }));
}

export async function deployDev(account, settings, repoRoot, deploy = deployAssets) {
  if (settings.environment !== "staging") throw new Error("Dev deployment requires ENVIRONMENT=staging");
  const chainId = await account.getChainId();
  if (BigInt(chainId) !== BigInt(shortString.encodeShortString("SN_MAIN")))
    throw new Error("Starknet mainnet required");
  const assets = await deploy(account, settings);
  const manifest = {
    chainId,
    ...assets,
    seasonId: 1,
    presetId: 1,
    start: settings.start.toString(),
    end: settings.end.toString(),
  };
  // Preserve the deployed addresses even if the later setup transaction fails.
  await writeDevDeployment(manifest, repoRoot);
  const setup = await account.execute(buildSetupCalls(assets, settings));
  await confirm(account, setup.transaction_hash);
  return { ...manifest, setupTransaction: setup.transaction_hash };
}

export async function writeDevDeployment(manifest, repoRoot) {
  await writeJsonFile(path.join(repoRoot, "contracts/l2/ledger/target/dev-deployment.json"), manifest);
  await mergeJsonFile(path.join(repoRoot, "contracts/common/addresses/dev.json"), {
    l2Chain: "SN_MAIN",
    ledger: manifest.ledger,
    lords: manifest.lords,
    mmrToken: manifest.mmr,
    lootChests: manifest.chests,
    cosmetics: manifest.cosmetics,
  });
}

if (import.meta.main)
  main().catch(() => {
    // SDK error objects may include signer configuration; only public status is printed.
    console.error(
      "Dev deployment failed; check settings, artifacts, saved deployment manifest and transaction receipts.",
    );
    process.exitCode = 1;
  });
