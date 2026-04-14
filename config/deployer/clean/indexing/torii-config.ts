import * as fs from "node:fs";
import * as path from "node:path";
import { ensureRepoDirectory, resolveRepoPath } from "../shared/repo";
import type { IndexerRequest } from "../types";

const TORII_TEMPLATE_PATH = "contracts/game/torii-template.toml";
const DEFAULT_WORLD_BLOCK = "0";

export interface RenderedToriiConfig {
  configPath: string;
  configContents: string;
}

export function renderToriiConfigArtifact(request: IndexerRequest, relativeDirectory: string): RenderedToriiConfig {
  const templatePath = resolveRepoPath(TORII_TEMPLATE_PATH);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing Torii template: ${TORII_TEMPLATE_PATH}`);
  }

  const outputDirectory = ensureRepoDirectory(relativeDirectory);
  const configPath = path.resolve(outputDirectory, "torii.toml");
  const template = fs.readFileSync(templatePath, "utf8");
  const namespaces = request.namespaces
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => `"${value}"`)
    .join(", ");
  const contracts = (request.externalContracts || []).map((value) => value.trim()).filter(Boolean);
  const configContents = replaceToriiContractsPlaceholder(
    template
      .replaceAll("{RPC_URL}", request.rpcUrl)
      .replaceAll("{WORLD_ADDRESS}", request.worldAddress)
      .replaceAll("{WORLD_BLOCK}", DEFAULT_WORLD_BLOCK)
      .replaceAll("{NAMESPACE}", namespaces),
    contracts,
  );

  fs.writeFileSync(configPath, configContents);

  return {
    configPath,
    configContents,
  };
}

function replaceToriiContractsPlaceholder(template: string, contracts: string[]): string {
  return template
    .split(/\r?\n/)
    .map((line) => {
      if (!line.includes("{CONTRACTS}")) {
        return line;
      }

      const indent = line.match(/^\s*/)?.[0] || "";
      if (contracts.length === 0) {
        return indent;
      }

      return contracts.map((value) => `${indent}"${value}",`).join("\n");
    })
    .join("\n");
}
