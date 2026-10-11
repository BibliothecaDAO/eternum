#!/usr/bin/env bun

import path from "node:path";
import { fileURLToPath } from "node:url";
import { CallData, byteArray, hash, shortString } from "starknet";
import { getContractArtifactPaths, readContractArtifacts } from "../../../../../scripts-runtime/js/artifacts.js";
import { mergeJsonFile, writeJsonFile } from "../../../../../scripts-runtime/js/files.js";
import { getAccount } from "../../../../../scripts-runtime/js/starknet.js";
import {
  buildLedgerEconomicPreset,
  buildPlayerGameLedgerPreset,
} from "../../../../../../config/deployer/clean/ledger/economics.ts";
import { PLAYER_GAME_LEDGER_PRESET_ID } from "../../../../../../config/source/common/ledger-presets.ts";
import { buildMysteryChestPreset } from "../../chest-preset.js";
import { frontierLedgerPresetId } from "./frontier.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const l2Root = path.dirname(packageRoot);
const manifestPath = path.join(packageRoot, "target", "sepolia-deployment.json");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadSettings() {
  const settings = {
    address: required("SEPOLIA_ACCOUNT_ADDRESS"),
    privateKey: required("SEPOLIA_ACCOUNT_PRIVATE_KEY"),
    operator: required("SEPOLIA_OPERATOR_ADDRESS"),
    pauser: required("SEPOLIA_PAUSER_ADDRESS"),
    start: BigInt(required("SEPOLIA_SEASON_START")),
    end: BigInt(required("SEPOLIA_SEASON_END")),
    chestCids: [1, 2, 3, 4, 5].map((band) => required(`SEPOLIA_CHEST_BAND_${band}_CID`)),
    cosmeticCid: required("SEPOLIA_COSMETIC_CID"),
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
      frontierLedgerPresetId("sepolia", 5),
      buildLedgerEconomicPreset("frontier"),
      chestPreset.bands,
      chestPreset.items,
    ]),
    call(assets.ledger, "register_preset", [
      PLAYER_GAME_LEDGER_PRESET_ID,
      buildPlayerGameLedgerPreset("sepolia"),
      chestPreset.bands,
      chestPreset.items,
    ]),
    call(assets.ledger, "open_season", [1, 1, settings.start, settings.end]),
  ];
}

async function main() {
  process.env.STARKNET_NETWORK = "sepolia";
  process.env.STARKNET_RPC = required("SEPOLIA_RPC_URL");
  const settings = loadSettings();
  const account = await getAccount({ accountAddress: settings.address, privateKey: settings.privateKey });
  const chainId = await account.getChainId();
  if (BigInt(chainId) !== BigInt(shortString.encodeShortString("SN_SEPOLIA"))) throw new Error("Sepolia required");
  const manifest = await deploySepolia(account, settings, path.resolve(packageRoot, "../../.."));
  console.log(JSON.stringify({ step: "ready", manifest: manifestPath, ...manifest }));
}

export async function deploySepolia(account, settings, repoRoot, deploy = deployAssets) {
  const chainId = await account.getChainId();
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
  await writeSepoliaDeployment(manifest, repoRoot);
  const setup = await account.execute(buildSetupCalls(assets, settings));
  await confirm(account, setup.transaction_hash);
  return { ...manifest, setupTransaction: setup.transaction_hash };
}

export async function writeSepoliaDeployment(manifest, repoRoot) {
  await writeJsonFile(path.join(repoRoot, "contracts/l2/ledger/target/sepolia-deployment.json"), manifest);
  await mergeJsonFile(path.join(repoRoot, "contracts/common/addresses/sepolia.json"), {
    ledger: manifest.ledger,
    mmrToken: manifest.mmr,
  });
}

if (import.meta.main)
  main().catch(() => {
    // SDK error objects may include signer configuration; only public status is printed.
    console.error(
      "Sepolia deployment failed; check settings, artifacts, saved deployment manifest and transaction receipts.",
    );
    process.exitCode = 1;
  });
