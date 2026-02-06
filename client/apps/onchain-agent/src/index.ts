import { EternumClient } from "@bibliothecadao/client";
import { createGameAgent } from "@mariozechner/pi-onchain-agent";
import { getModel } from "@mariozechner/pi-ai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Account } from "starknet";
import { loadConfig } from "./config";
import { EternumGameAdapter } from "./adapter/eternum-adapter";
import { createApp } from "./tui/app";

export async function loadManifest(manifestPath: string): Promise<{ contracts: unknown[] }> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.contracts)) {
    throw new Error(`Invalid manifest at ${manifestPath}: missing contracts[]`);
  }
  return parsed;
}

export async function main() {
  const config = loadConfig();
  const manifestPath = path.resolve(config.manifestPath);
  const manifest = await loadManifest(manifestPath);

  console.log("Initializing Eternum Agent...");
  console.log(`  RPC: ${config.rpcUrl}`);
  console.log(`  Torii: ${config.toriiUrl}`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  Model: ${config.modelProvider}/${config.modelId}`);

  // 1. Create the Eternum client
  const client = await EternumClient.create({
    rpcUrl: config.rpcUrl,
    toriiUrl: config.toriiUrl,
    worldAddress: config.worldAddress,
    manifest,
  });

  // 2. Set up the signer
  const account = new Account({
    provider: { nodeUrl: config.rpcUrl },
    address: config.accountAddress,
    signer: config.privateKey,
  });
  client.connect(account);

  // 3. Create the game adapter
  const adapter = new EternumGameAdapter(client, account, config.accountAddress);

  // 4. Create the game agent
  const model = getModel(config.modelProvider, config.modelId);
  const { agent, ticker, dispose: disposeAgent } = createGameAgent({
    adapter,
    dataDir: config.dataDir,
    model,
    tickIntervalMs: config.tickIntervalMs,
  });

  // 5. Create the TUI
  const { dispose: disposeTui } = createApp({ agent, ticker });

  // 6. Start the tick loop
  ticker.start();

  console.log("Agent running. Press Ctrl+C to exit.\n");

  // 7. Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    ticker.stop();
    await disposeAgent();
    disposeTui();
    client.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function isDirectExecution(metaUrl: string): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    const currentModulePath = fileURLToPath(metaUrl);
    return path.resolve(process.argv[1]) === path.resolve(currentModulePath);
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
