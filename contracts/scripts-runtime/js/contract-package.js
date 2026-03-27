import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readNamedArgumentValue, readNamedListArgument } from "./cli-args.js";
import { printRuntimeBanner, printRuntimeStep } from "./output.js";
import { loadNetworkEnvironment, resolveContractsCommonEnvFile } from "./environment.js";

function ensureRuntimeFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found at ${filePath}`);
  }
}

function runRuntimeCommand({ args, command, cwd, env, label }) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function resolvePackageTaskContext({ actionName, networkName, packageLabel, packageRoot }) {
  const absolutePackageRoot = path.resolve(packageRoot);
  const repoRoot = path.resolve(absolutePackageRoot, "..", "..");
  const runtimeRoot = path.join(repoRoot, "contracts", "scripts-runtime");
  const actionLabelByName = {
    declare: "Declaring",
    deploy: "Deploying",
    "grant-roles": "Granting roles for",
    "revoke-roles": "Revoking roles for",
    upgrade: "Upgrading",
  };

  return {
    actionLabel: actionLabelByName[actionName] ?? `Running ${actionName} for`,
    envFilePath: resolveContractsCommonEnvFile(repoRoot, networkName),
    manifestPath: path.join(absolutePackageRoot, "scripts", "commands", "deployment", "manifest.js"),
    networkName,
    packageLabel,
    packageRoot: absolutePackageRoot,
    runtimeRoot,
  };
}

async function loadContractPackageManifest(manifestPath) {
  const moduleUrl = pathToFileURL(path.resolve(manifestPath)).href;
  const manifestModule = await import(moduleUrl);
  const manifest = manifestModule.default ?? manifestModule.contractPackageManifest;

  if (!manifest) {
    throw new Error(`Deployment manifest not found in ${manifestPath}`);
  }

  return manifest;
}

function buildContractPackage(packageRoot, packageLabel) {
  printRuntimeStep(`Building ${packageLabel} with Scarb...`);
  runRuntimeCommand({
    args: ["--release", "build"],
    command: "scarb",
    cwd: packageRoot,
    label: `${packageLabel} build`,
  });
}

function installSharedRuntimeDependencies(runtimeRoot) {
  printRuntimeStep("Installing shared deployment runtime dependencies...");
  runRuntimeCommand({
    args: ["install"],
    command: "bun",
    cwd: runtimeRoot,
    label: "shared deployment runtime install",
  });
}

function loadPackageTaskEnvironment(envFilePath, networkName) {
  loadNetworkEnvironment(envFilePath, networkName);
}

async function executeContractPackageAction({ actionName, actionOptions, manifestPath, networkName }) {
  printRuntimeStep(`Executing ${actionName} for ${networkName}...`);
  const manifest = await loadContractPackageManifest(manifestPath);
  const {
    declarePackageContracts,
    deployPackageContracts,
    grantRolesForPackageContracts,
    revokeRolesForPackageContracts,
    upgradePackageContracts,
  } = await import("./package-runner.js");

  if (actionName === "declare") {
    await declarePackageContracts(manifest, actionOptions);
    return;
  }

  if (actionName === "deploy") {
    await deployPackageContracts(manifest, actionOptions);
    return;
  }

  if (actionName === "upgrade") {
    await upgradePackageContracts(manifest, actionOptions);
    return;
  }

  if (actionName === "grant-roles") {
    await grantRolesForPackageContracts(manifest, actionOptions);
    return;
  }

  if (actionName === "revoke-roles") {
    await revokeRolesForPackageContracts(manifest, actionOptions);
    return;
  }

  throw new Error(`Unsupported action ${actionName}`);
}

export function parseContractPackageActionOptions(args) {
  return {
    onlyTargetIds: readNamedListArgument(args, "--only"),
    skipTargetIds: readNamedListArgument(args, "--skip"),
  };
}

export async function runContractPackageTask({
  actionName,
  actionOptions = {},
  networkName,
  packageLabel,
  packageRoot,
}) {
  const context = resolvePackageTaskContext({
    actionName,
    networkName,
    packageLabel,
    packageRoot,
  });

  ensureRuntimeFileExists(context.envFilePath, "network env file");
  ensureRuntimeFileExists(context.manifestPath, "deployment manifest");

  printRuntimeBanner(`${context.actionLabel} ${context.packageLabel}`);
  buildContractPackage(context.packageRoot, context.packageLabel);
  installSharedRuntimeDependencies(context.runtimeRoot);
  loadPackageTaskEnvironment(context.envFilePath, context.networkName);
  await executeContractPackageAction({
    actionName,
    actionOptions,
    manifestPath: context.manifestPath,
    networkName: context.networkName,
  });
}
