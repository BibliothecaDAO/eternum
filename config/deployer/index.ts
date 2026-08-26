import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest } from "@contracts";
import type { GameChain } from "@realms-world/chain";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "../utils/confirmation";
import { logNetwork, saveResolvedConfigJson, type GameType } from "../utils/environment";
import { GameConfigDeployer, nodeReadConfig } from "./config";
import { withBatching } from "./tx-batcher";

const VALID_NETWORKS: GameChain[] = ["madara", "appchain"];
const VALID_GAME_TYPES: GameType[] = ["blitz", "eternum"];

function printDeployerUsage(): void {
  console.error(`Usage: bun run ./deployer/index.ts <network> <game_type>`);
  console.error(`  network must be one of: ${VALID_NETWORKS.join(", ")}`);
}

function printDeployerGameTypeUsage(): void {
  console.error(`Usage: bun run ./deployer/index.ts <network> <game_type>`);
  console.error(`  game_type must be one of: ${VALID_GAME_TYPES.join(", ")}`);
}

function resolveDeployerTarget(argv: string[]): { gameType: GameType; network: GameChain } {
  const network = argv[2] as GameChain;
  const gameType = argv[3] as GameType;

  if (!network || !VALID_NETWORKS.includes(network)) {
    printDeployerUsage();
    process.exit(1);
  }

  if (!gameType || !VALID_GAME_TYPES.includes(gameType)) {
    printDeployerGameTypeUsage();
    process.exit(1);
  }

  return { gameType, network };
}

async function createDeployerProvider(network: GameChain, gameType: GameType): Promise<EternumProvider> {
  const manifest = await getGameManifest(network, gameType);
  return new EternumProvider(
    manifest,
    process.env.RPC_URL || process.env.VITE_PUBLIC_NODE_URL,
    process.env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
  );
}

function createDeployerAccount(provider: EternumProvider): Account {
  const address = process.env.DOJO_ACCOUNT_ADDRESS;
  const privateKey = process.env.DOJO_PRIVATE_KEY;
  if (!address || !privateKey) {
    throw new Error("DOJO_ACCOUNT_ADDRESS and DOJO_PRIVATE_KEY are required for config deployment");
  }
  return new Account({
    provider: provider.provider,
    address,
    signer: privateKey,
  });
}

function resolveBatchMode(): { immediateEntrypoints: string[]; isBatchMode: boolean } {
  return {
    isBatchMode: process.env.CONFIG_BATCH === "1" || process.env.CONFIG_BATCH === "true",
    immediateEntrypoints: (process.env.CONFIG_IMMEDIATE_ENTRYPOINTS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

async function createConfigDeployer(network: GameChain, gameType: GameType): Promise<GameConfigDeployer> {
  await saveResolvedConfigJson(network, gameType);
  const configuration = await nodeReadConfig(network, gameType);
  return new GameConfigDeployer(configuration, network);
}

async function runConfigDeployment(): Promise<void> {
  const { gameType, network } = resolveDeployerTarget(process.argv);

  confirmNonLocalDeployment(network);

  const provider = await createDeployerProvider(network, gameType);
  const account = createDeployerAccount(provider);
  const configDeployer = await createConfigDeployer(network, gameType);
  const batchMode = resolveBatchMode();

  logNetwork(network);

  if (batchMode.isBatchMode) {
    configDeployer.skipSleeps = true;
    const flushReceipt = await withBatching(
      provider,
      account,
      async () => {
        await configDeployer.setupAll(account, provider);
      },
      { immediateEntrypoints: batchMode.immediateEntrypoints, label: "config" },
    );
    console.log("Batched multicall submitted:", (flushReceipt as any)?.transaction_hash ?? "<unknown>");
  } else {
    await configDeployer.setupAll(account, provider);
  }

  logNetwork(network);
}

await runConfigDeployment();
