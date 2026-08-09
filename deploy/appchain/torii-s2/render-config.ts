#!/usr/bin/env bun
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatError, optionalString, parseCliArgs, requireString, writeJsonReport } from "./shared/cli";
import { normalizeFelt } from "./shared/torii";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_PATH = path.join(SCRIPT_DIRECTORY, "torii.toml.template");
const DEFAULT_OUTPUT_PATH = path.join(SCRIPT_DIRECTORY, "torii.toml");

interface ToriiConfigValues {
  rpcUrl: string;
  dbDir: string;
  worldAddress: string;
}

export function renderToriiConfig(template: string, values: ToriiConfigValues): string {
  const replacements: Record<string, string> = {
    RPC_URL: requireTomlString(values.rpcUrl, "RPC URL"),
    DB_DIR: requireTomlString(values.dbDir, "database directory"),
    WORLD_ADDRESS: normalizeFelt(values.worldAddress),
  };

  const rendered = template.replace(/\{([A-Z_]+)\}/g, (placeholder, key: string) => {
    const value = replacements[key];
    if (value === undefined) {
      throw new Error(`Unknown Torii template placeholder ${placeholder}`);
    }
    return value;
  });

  const unresolved = rendered.match(/\{[A-Z_]+\}/g);
  if (unresolved) {
    throw new Error(`Unresolved Torii template placeholders: ${unresolved.join(", ")}`);
  }
  return rendered;
}

function requireTomlString(value: string, label: string): string {
  if (!value.trim()) {
    throw new Error(`${label} cannot be empty`);
  }
  if (/["\n\r]/.test(value)) {
    throw new Error(`${label} contains characters that are unsafe in a TOML string`);
  }
  return value;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const templatePath = path.resolve(optionalString(args, "template") ?? DEFAULT_TEMPLATE_PATH);
  const outputPath = path.resolve(optionalString(args, "output") ?? DEFAULT_OUTPUT_PATH);
  const values: ToriiConfigValues = {
    rpcUrl: optionalString(args, "rpc") ?? "http://katana:5050",
    dbDir: optionalString(args, "db-dir") ?? "/data/torii-db-v1",
    worldAddress: requireString(args, "world"),
  };

  const rendered = renderToriiConfig(await Bun.file(templatePath).text(), values);
  await Bun.write(outputPath, rendered);
  await writeJsonReport({
    status: "PASS",
    templatePath,
    outputPath,
    worldAddress: normalizeFelt(values.worldAddress),
    rpcUrl: values.rpcUrl,
    dbDir: values.dbDir,
  });
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
