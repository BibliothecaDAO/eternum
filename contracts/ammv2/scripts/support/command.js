import path from "node:path";
import { fileURLToPath } from "node:url";
import { readNamedArgumentValue } from "../../../scripts-runtime/js/cli-args.js";
import {
  parseContractPackageActionOptions,
  runContractPackageTask,
} from "../../../scripts-runtime/js/contract-package.js";

const SUPPORTED_AMMV2_DEPLOYMENT_NETWORKS = new Set(["mainnet", "sepolia", "slot"]);

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

export async function runAmmv2PackageTaskFromCli({ actionName, args, importMetaUrl }) {
  await runContractPackageTask({
    actionName,
    actionOptions: parseContractPackageActionOptions(args.slice(3)),
    networkName: resolveAmmv2DeploymentNetworkName(args),
    packageLabel: "RealmsSwap AMMv2",
    packageRoot: resolveAmmv2PackageRoot(importMetaUrl),
  });
}
