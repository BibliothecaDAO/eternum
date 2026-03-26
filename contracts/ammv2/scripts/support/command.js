import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";
import { readNamedArgumentValue } from "../../../scripts-runtime/js/cli-args.js";
import { printRuntimeStep, printRuntimeValue } from "../../../scripts-runtime/js/output.js";
import {
  parseContractPackageActionOptions,
  runContractPackageTask,
} from "../../../scripts-runtime/js/contract-package.js";

const SUPPORTED_AMMV2_DEPLOYMENT_NETWORKS = new Set(["mainnet", "sepolia", "slot"]);
const MAINNET_CONFIRMATION_PHRASE = "mainnet";
const MAINNET_CONFIRMATION_FLAG = "--confirm-mainnet";

export function resolveAmmv2DeploymentNetworkName(args) {
  const networkName = args[2];

  if (!networkName) {
    throw new Error("Missing AMMv2 deployment network. Use one of: slot, sepolia, mainnet");
  }

  if (!SUPPORTED_AMMV2_DEPLOYMENT_NETWORKS.has(networkName)) {
    throw new Error(`Unsupported AMMv2 deployment network ${networkName}. Use one of: slot, sepolia, mainnet`);
  }

  return networkName;
}

export function resolveAmmv2PackageRoot(importMetaUrl) {
  const commandFilePath = fileURLToPath(importMetaUrl);
  const commandDirectoryPath = path.dirname(commandFilePath);
  return path.join(commandDirectoryPath, "..", "..", "..");
}

export { readNamedArgumentValue };

function isMainnetNetwork(networkName) {
  return networkName === "mainnet";
}

function hasMainnetConfirmationFlag(args) {
  return args.includes(MAINNET_CONFIRMATION_FLAG);
}

function ensureMainnetConfirmationCanPrompt(actionName) {
  if (input.isTTY && output.isTTY) {
    return;
  }

  throw new Error(`Mainnet ${actionName} requires interactive confirmation or ${MAINNET_CONFIRMATION_FLAG}`);
}

async function promptForMainnetConfirmation(actionName) {
  const readline = createInterface({ input, output });

  try {
    printRuntimeStep(`Mainnet ${actionName} requires confirmation.`);
    printRuntimeValue("Confirmation phrase:", MAINNET_CONFIRMATION_PHRASE);

    const response = await readline.question("Type mainnet to continue: ");

    if (response.trim().toLowerCase() !== MAINNET_CONFIRMATION_PHRASE) {
      throw new Error(`Cancelled mainnet ${actionName}`);
    }
  } finally {
    readline.close();
  }
}

export async function confirmMainnetActionIfNeeded({ actionName, args, networkName }) {
  if (!isMainnetNetwork(networkName)) {
    return;
  }

  if (hasMainnetConfirmationFlag(args)) {
    return;
  }

  ensureMainnetConfirmationCanPrompt(actionName);
  await promptForMainnetConfirmation(actionName);
}

export async function runAmmv2PackageTaskFromCli({ actionName, args, importMetaUrl }) {
  const networkName = resolveAmmv2DeploymentNetworkName(args);

  await confirmMainnetActionIfNeeded({
    actionName,
    args,
    networkName,
  });

  await runContractPackageTask({
    actionName,
    actionOptions: parseContractPackageActionOptions(args.slice(3)),
    networkName,
    packageLabel: "RealmsSwap AMMv2",
    packageRoot: resolveAmmv2PackageRoot(importMetaUrl),
  });
}
