import fs from "node:fs";
import path from "node:path";
import { printRuntimeStep } from "./output.js";

function stripWrappingQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function applyEnvironmentVariablesFromFile(envFilePath) {
  const lines = fs.readFileSync(envFilePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    const normalizedLine = trimmedLine.startsWith("export ") ? trimmedLine.slice("export ".length) : trimmedLine;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(rawValue);
  }
}

export function resolveContractsCommonEnvFile(repoRoot, networkName) {
  return path.join(repoRoot, "contracts", "common", `.env.${networkName}`);
}

export function loadNetworkEnvironment(envFilePath, networkName) {
  printRuntimeStep(`Loading ${networkName} environment configuration...`);
  applyEnvironmentVariablesFromFile(envFilePath);
  process.env.STARKNET_NETWORK = networkName;
}
