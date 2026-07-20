import fs from "node:fs";
import process from "node:process";

const defaultSourcePaths = [
  "config/deployer/clean/runtime/provider-config.ts",
  "config/deployer/clean/cli/indexer-maintenance.ts",
  "config/deployer/clean/launch/runner.ts",
  "config/deployer/clean/indexing/indexer.ts",
  "common/factory/endpoints.ts",
  "client/apps/game/env.ts",
  "client/apps/game/src/runtime/world/factory-endpoints.ts",
];
const defaultWorkflowPaths = [
  ".github/workflows/game-launch.yml",
  ".github/workflows/factory-indexer-maintenance.yml",
  ".github/workflows/factory-torii-deployer.yml",
];
const retiredProviderSwitches = [
  { name: "INDEXER_RUNTIME_PROVIDER", pattern: /\bINDEXER_RUNTIME_PROVIDER\b/ },
  { name: "FACTORY_RUNTIME_PROVIDER", pattern: /(?<!VITE_)\bFACTORY_RUNTIME_PROVIDER\b/ },
];

function main() {
  const sourcePaths = resolveConfiguredPaths("AWS_RUNTIME_PROVIDER_CHECK_SOURCE_PATHS", defaultSourcePaths);
  const workflowPaths = resolveConfiguredPaths("AWS_RUNTIME_PROVIDER_CHECK_WORKFLOW_PATHS", defaultWorkflowPaths);
  const failures = [
    ...validateProviderSourcePaths(sourcePaths),
    ...validateProviderWorkflowPaths(workflowPaths),
    ...validateProviderResolver(sourcePaths),
  ];

  if (failures.length === 0) {
    return;
  }

  console.error("AWS runtime provider configuration checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

function resolveConfiguredPaths(envName, defaults) {
  const configured = process.env[envName]?.trim();
  if (!configured) {
    return defaults;
  }

  return configured
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
}

function validateProviderSourcePaths(paths) {
  return paths.flatMap((path) => findRetiredProviderSwitches(path, fs.readFileSync(path, "utf8")));
}

function validateProviderWorkflowPaths(paths) {
  return paths.flatMap((path) => {
    const source = fs.readFileSync(path, "utf8");
    return [...findRetiredProviderSwitches(path, source), ...validateWorkflowRuntimeProvider(path, source)];
  });
}

function findRetiredProviderSwitches(path, source) {
  return retiredProviderSwitches
    .filter((retiredSwitch) => retiredSwitch.pattern.test(source))
    .map((retiredSwitch) => `${path} references retired provider switch ${retiredSwitch.name}`);
}

function validateWorkflowRuntimeProvider(path, source) {
  const failures = [];

  if (!workflowHardcodesAwsProvider(source)) {
    failures.push(`${path} workflow must pin RUNTIME_PROVIDER: aws`);
  }

  if (source.includes("vars.RUNTIME_PROVIDER") || /RUNTIME_PROVIDER[^\n]*slot/i.test(source)) {
    failures.push(`${path} workflow must not expose an active Slot provider fallback`);
  }
  if (/^\s*-\s*(?:slot|slottest)\.(?:blitz|eternum)\s*$/m.test(source)) {
    failures.push(`${path} workflow must not expose historical Slot environments`);
  }

  return failures;
}

function workflowHardcodesAwsProvider(source) {
  return /^(\s*)RUNTIME_PROVIDER:\s*["']?aws["']?\s*$/m.test(source);
}

function validateProviderResolver(paths) {
  const providerConfigPath = paths.find((path) => path.endsWith("runtime/provider-config.ts"));
  if (!providerConfigPath) {
    return [];
  }

  const source = fs.readFileSync(providerConfigPath, "utf8");
  const requiredSnippets = [
    "process.env.RUNTIME_PROVIDER_OVERRIDE",
    "process.env.RUNTIME_PROVIDER",
    "environment.runtimeProvider",
  ];

  return requiredSnippets
    .filter((snippet) => !source.includes(snippet))
    .map((snippet) => `${providerConfigPath} missing provider resolver snippet: ${snippet}`);
}

main();
