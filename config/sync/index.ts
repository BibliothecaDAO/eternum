import { saveResolvedConfigJson, type GameType, type NetworkType } from "../utils/environment";

const VALID_NETWORKS: NetworkType[] = ["local", "mainnet", "sepolia", "slot", "slottest"];
const VALID_GAME_TYPES: GameType[] = ["blitz", "eternum"];

function printSyncUsage(): void {
  console.error(`Usage: bun run ./sync/index.ts <network> <game_type>`);
  console.error(`  network must be one of: ${VALID_NETWORKS.join(", ")}`);
}

function printGameTypeUsage(): void {
  console.error(`Usage: bun run ./sync/index.ts <network> <game_type>`);
  console.error(`  game_type must be one of: ${VALID_GAME_TYPES.join(", ")}`);
}

function resolveSyncTarget(argv: string[]): { gameType: GameType; network: NetworkType } {
  const network = argv[2] as NetworkType;
  const gameType = argv[3] as GameType;

  if (!network || !VALID_NETWORKS.includes(network)) {
    printSyncUsage();
    process.exit(1);
  }

  if (!gameType || !VALID_GAME_TYPES.includes(gameType)) {
    printGameTypeUsage();
    process.exit(1);
  }

  return { gameType, network };
}

async function runConfigSync(): Promise<void> {
  const { gameType, network } = resolveSyncTarget(process.argv);

  console.log(`\n🔄 Syncing ${gameType} configuration JSON for ${network}...\n`);
  await saveResolvedConfigJson(network, gameType);
  console.log(`✅ Configuration JSON updated successfully for ${gameType} on ${network}\n`);
}

await runConfigSync();
