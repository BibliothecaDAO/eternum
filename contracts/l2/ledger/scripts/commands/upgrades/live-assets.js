#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hash } from "starknet";
import { getContractArtifactPaths } from "../../../../../scripts-runtime/js/artifacts.js";
import { loadJsonConfigFile } from "../../../../../scripts-runtime/js/config.js";
import { loadNetworkEnvironment } from "../../../../../scripts-runtime/js/environment.js";
import {
  declareContract,
  executeContractCall,
  getProvider,
  upgradeContract,
} from "../../../../../scripts-runtime/js/starknet.js";
import { buildLiveAssetPlan } from "./live-assets-plan.js";
import { assertLedgerRpc } from "../ledger-rpc.js";

const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(commandDirectory, "..", "..", "..", "..", "..", "..");
const execute = process.argv.includes("--execute");

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runLiveAssetUpgrade({ execute });

export async function runLiveAssetUpgrade({ execute: shouldExecute }) {
  loadNetworkEnvironment(
    path.join(repoRoot, "contracts", "common", ".env.mainnet"),
    "mainnet",
    path.join(repoRoot, ".env"),
  );
  await assertLedgerRpc();
  const addresses = loadJsonConfigFile(path.join(repoRoot, "contracts", "common", "addresses", "mainnet.json"));
  const plan = buildLiveAssetPlan(addresses, process.env, shouldExecute);

  buildLiveAssetContracts(plan.assets);
  await verifyMainnetPlan(plan);
  if (!shouldExecute) {
    log("live_asset_upgrade_checked", summarizePlan(plan));
    return;
  }

  const classHashes = await declareLiveAssetClasses(plan);
  await upgradeLiveAssets(plan, classHashes);
  await configureSeasonPassRestorer(plan);
  await grantLedgerRoles(plan);
  await verifyAppliedPlan(plan, classHashes);
  log("live_asset_upgrade_complete", summarizePlan(plan));
}

function buildLiveAssetContracts(assets) {
  for (const asset of assets) {
    const packageRoot = path.join(repoRoot, "contracts", asset.packageDirectory);
    const result = spawnSync("scarb", ["--release", "build"], { cwd: packageRoot, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`${asset.label} build failed with exit code ${result.status}`);
  }
}

async function verifyMainnetPlan(plan) {
  const provider = getProvider();

  for (const asset of plan.assets) await provider.getClassHashAt(asset.address);
  await provider.getClassHashAt(plan.ledgerAddress);
  for (const asset of plan.assets) await assertUpgradeAuthority(provider, asset);
  for (const grant of plan.roleGrants) {
    await assertRole(provider, grant.contractAddress, "DEFAULT_ADMIN_ROLE", grant.adminSigner.address);
  }
}

async function declareLiveAssetClasses(plan) {
  const classHashes = new Map();
  for (const asset of plan.assets) {
    const classHash = await declareContract({
      accountAddress: plan.declarationSigner.address,
      artifactPaths: artifactPaths(asset),
      label: asset.label,
      privateKey: plan.declarationSigner.privateKey,
    });
    classHashes.set(asset.id, classHash);
  }
  return classHashes;
}

async function upgradeLiveAssets(plan, classHashes) {
  for (const asset of plan.assets) {
    await upgradeContract({
      accountAddress: asset.upgradeSigner.address,
      contractAddress: asset.address,
      label: asset.label,
      newClassHash: requireClassHash(classHashes, asset.id),
      privateKey: asset.upgradeSigner.privateKey,
    });
  }
}

async function grantLedgerRoles(plan) {
  for (const grant of plan.roleGrants) {
    await executeContractCall({
      accountAddress: grant.adminSigner.address,
      calldata: [roleSelector(grant.roleName), grant.grantee],
      contractAddress: grant.contractAddress,
      entrypoint: "grant_role",
      label: `${grant.assetId} ${grant.roleName} grant to ledger`,
      privateKey: grant.adminSigner.privateKey,
    });
  }
}

async function configureSeasonPassRestorer(plan) {
  const { contractAddress, restorer, signer } = plan.seasonPassRestorer;
  await executeContractCall({
    accountAddress: signer.address,
    calldata: [restorer],
    contractAddress,
    entrypoint: "set_restorer",
    label: "Season Pass restorer configuration",
    privateKey: signer.privateKey,
  });
}

async function verifyAppliedPlan(plan, classHashes) {
  const provider = getProvider();
  for (const asset of plan.assets) {
    const actualClassHash = await provider.getClassHashAt(asset.address);
    const expectedClassHash = requireClassHash(classHashes, asset.id);
    if (BigInt(actualClassHash) !== BigInt(expectedClassHash)) {
      throw new Error(`${asset.label} class hash did not change to the declared class`);
    }
  }
  for (const grant of plan.roleGrants) {
    await assertRole(provider, grant.contractAddress, grant.roleName, grant.grantee);
  }
  await assertSeasonPassRestorer(provider, plan.seasonPassRestorer);
}

async function assertSeasonPassRestorer(provider, config) {
  const result = await provider.callContract(
    { contractAddress: config.contractAddress, entrypoint: "get_restorer", calldata: [] },
    "latest",
  );
  if (result.length !== 1 || BigInt(result[0]) !== BigInt(config.restorer)) {
    throw new Error(`Season Pass restorer is not the ledger`);
  }
}

async function assertOwner(provider, contractAddress, expectedOwner) {
  const result = await provider.callContract({ contractAddress, entrypoint: "owner", calldata: [] }, "latest");
  if (result.length !== 1 || BigInt(result[0]) !== BigInt(expectedOwner)) {
    throw new Error(`SEASON_PASS_OWNER_ADDRESS is not the live Season Pass owner`);
  }
}

async function assertUpgradeAuthority(provider, asset) {
  if (asset.upgradeAuthorityKind === "owner") {
    await assertOwner(provider, asset.address, asset.upgradeSigner.address);
    return;
  }
  await assertRole(provider, asset.address, asset.upgradeRoleName, asset.upgradeSigner.address);
}

async function assertRole(provider, contractAddress, roleName, accountAddress) {
  const result = await provider.callContract(
    { contractAddress, entrypoint: "has_role", calldata: [roleSelector(roleName), accountAddress] },
    "latest",
  );
  if (result.length !== 1 || BigInt(result[0]) !== 1n) {
    throw new Error(`${accountAddress} does not hold ${roleName} on ${contractAddress}`);
  }
}

function artifactPaths(asset) {
  return getContractArtifactPaths(
    path.join(repoRoot, "contracts", asset.packageDirectory, "target", "release"),
    asset.projectName,
    asset.artifactName,
  );
}

function requireClassHash(classHashes, assetId) {
  const classHash = classHashes.get(assetId);
  if (!classHash) throw new Error(`Missing declared class hash for ${assetId}`);
  return classHash;
}

function roleSelector(roleName) {
  return roleName === "DEFAULT_ADMIN_ROLE" ? 0n : BigInt(hash.getSelectorFromName(roleName));
}

function summarizePlan(plan) {
  return {
    assets: plan.assets.map(({ address, id, upgradeSigner }) => ({ address, id, signer: upgradeSigner.address })),
    ledgerAddress: plan.ledgerAddress,
    roleGrants: plan.roleGrants.map(({ adminSigner, assetId, roleName }) => ({
      admin: adminSigner.address,
      assetId,
      roleName,
    })),
    seasonPassRestorer: {
      contractAddress: plan.seasonPassRestorer.contractAddress,
      restorer: plan.seasonPassRestorer.restorer,
    },
  };
}

function log(event, fields) {
  console.info(JSON.stringify({ event, ...fields }));
}
