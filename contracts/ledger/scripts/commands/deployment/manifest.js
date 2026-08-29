import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "starknet";
import { loadJsonConfigFile, requireAddressConfigValue } from "../../../../scripts-runtime/js/config.js";
import { mergeEnvironmentFile, mergeJsonFile } from "../../../../scripts-runtime/js/files.js";
import { executeContractCalls, getSelectedNetworkName } from "../../../../scripts-runtime/js/starknet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, "..", "..", "..");
const repoRoot = path.join(packageRoot, "..", "..");
const networkName = getSelectedNetworkName();
const commonAddressesPath = path.join(repoRoot, "contracts", "common", "addresses", `${networkName}.json`);
const labEnvironmentPath = path.join(repoRoot, "deploy", "madara-lab", ".env");
const addresses = loadJsonConfigFile(commonAddressesPath);

function requireEnvironmentAddress(name) {
  return requireNonZeroAddress(process.env[name], name);
}

function requireContractAddress(name) {
  return requireNonZeroAddress(addresses[name], `contracts/common/addresses/${networkName}.json:${name}`);
}

function requireNonZeroAddress(value, label) {
  const address = requireAddressConfigValue(value, label);
  if (BigInt(address) === 0n) throw new Error(`${label} must not be zero`);
  return address;
}

function assertRoleAdminSigner(accountAddress) {
  for (const [label, address] of [
    ["MMR_DEFAULT_ADMIN", requireEnvironmentAddress("MMR_DEFAULT_ADMIN")],
    ["SEASON_PASS_ADMIN", requireEnvironmentAddress("SEASON_PASS_ADMIN")],
  ]) {
    if (BigInt(address) !== BigInt(accountAddress)) {
      throw new Error(`STARKNET_ACCOUNT_ADDRESS must match ${label} to grant the ledger role`);
    }
  }
}

const deploymentAccountAddress = requireEnvironmentAddress("STARKNET_ACCOUNT_ADDRESS");
assertRoleAdminSigner(deploymentAccountAddress);
const constructorAddresses = {
  admin: requireEnvironmentAddress("LEDGER_ADMIN_ADDRESS"),
  operator: requireEnvironmentAddress("LEDGER_OPERATOR_ADDRESS"),
  treasury: requireEnvironmentAddress("LEDGER_TREASURY_ADDRESS"),
  lords: requireContractAddress("lords"),
  mmrToken: requireContractAddress("mmrToken"),
  seasonPass: requireContractAddress("seasonPass"),
  villagePass: requireContractAddress("villagePass"),
  lootChests: requireContractAddress("lootChests"),
  eliteInvite: requireContractAddress("eliteInvite"),
  cosmetics: requireContractAddress("cosmetics"),
};
const ledgerRpcUrl = requireAddressConfigValue(process.env.STARKNET_RPC, "STARKNET_RPC");

function buildConstructorCalldata() {
  return [
    constructorAddresses.admin,
    constructorAddresses.operator,
    constructorAddresses.treasury,
    constructorAddresses.lords,
    constructorAddresses.mmrToken,
    constructorAddresses.seasonPass,
    constructorAddresses.villagePass,
    constructorAddresses.lootChests,
    constructorAddresses.eliteInvite,
    constructorAddresses.cosmetics,
  ];
}

async function grantLedgerRoles({ deployedAddress, runtimeConfig }) {
  await executeContractCalls({
    accountAddress: runtimeConfig.accountAddress,
    calls: [
      {
        calldata: [hash.getSelectorFromName("UPDATER_ROLE"), deployedAddress],
        contractAddress: constructorAddresses.mmrToken,
        entrypoint: "grant_role",
      },
      {
        calldata: [hash.getSelectorFromName("DISTRIBUTOR_ROLE"), deployedAddress],
        contractAddress: constructorAddresses.villagePass,
        entrypoint: "grant_role",
      },
    ],
    label: "ledger prerequisite roles",
  });
}

async function exportLedgerAddresses(deployedAddress) {
  await mergeJsonFile(commonAddressesPath, { ledger: deployedAddress });
  await mergeEnvironmentFile(labEnvironmentPath, {
    LEDGER_ADDRESS: deployedAddress,
    LEDGER_RPC_URL: ledgerRpcUrl,
    LORDS_ADDRESS: constructorAddresses.lords,
    MMR_TOKEN_ADDRESS: constructorAddresses.mmrToken,
    SEASON_PASS_ADDRESS: constructorAddresses.seasonPass,
    VILLAGE_PASS_ADDRESS: constructorAddresses.villagePass,
    LOOT_CHESTS_ADDRESS: constructorAddresses.lootChests,
    ELITE_INVITE_ADDRESS: constructorAddresses.eliteInvite,
    COSMETICS_ADDRESS: constructorAddresses.cosmetics,
    VAULT_ADDRESS: addresses.vault ?? "",
  });
}

async function finalizeLedgerDeployment(context) {
  await grantLedgerRoles(context);
  await exportLedgerAddresses(context.deployedAddress);
}

export const contractPackageManifest = {
  addressesFilePath: path.join(packageRoot, "scripts", "state", "addresses", `${networkName}.json`),
  declarations: [
    {
      artifactName: "GameLedger",
      id: "ledger",
      label: "Realms game ledger",
      stateKey: "ledgerClassHash",
    },
  ],
  deployments: [
    {
      classHashDeclarationId: "ledger",
      constructorCalldata: buildConstructorCalldata,
      declarationIds: ["ledger"],
      dependencyIds: [],
      finalizeDeployment: finalizeLedgerDeployment,
      id: "ledger",
      label: "Realms game ledger",
      stateKey: "ledger",
    },
  ],
  projectName: "game_ledger",
  runtimeConfig: {
    accountAddress: deploymentAccountAddress,
  },
  targetDir: path.join(packageRoot, "target", "release"),
};

export default contractPackageManifest;
