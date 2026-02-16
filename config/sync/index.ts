import { saveConfigJsonFromConfigTsFile, type GameType, type NetworkType } from "../utils/environment";

const VALID_GAME_TYPES: GameType[] = ["blitz", "eternum"];
const gameType = process.argv[2] as GameType;
if (!gameType || !VALID_GAME_TYPES.includes(gameType)) {
  console.error(`Usage: bun run ./sync/index.ts <game_type>`);
  console.error(`  game_type must be one of: ${VALID_GAME_TYPES.join(", ")}`);
  process.exit(1);
}

const { VITE_PUBLIC_CHAIN } = process.env;

if (!VITE_PUBLIC_CHAIN) {
  console.error("Error: VITE_PUBLIC_CHAIN environment variable is not set");
  process.exit(1);
}

console.log(`\n🔄 Syncing ${gameType} configuration JSON for ${VITE_PUBLIC_CHAIN}...\n`);

await saveConfigJsonFromConfigTsFile(VITE_PUBLIC_CHAIN as NetworkType, gameType);

console.log(`✅ Configuration JSON updated successfully for ${gameType} on ${VITE_PUBLIC_CHAIN}\n`);
