import { EternumProvider } from "@bibliothecadao/provider";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import { getGameManifest } from "@contracts";
import chalk from "chalk";
import { nodeReadConfig } from "deployer/config";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "utils/confirmation";
import { logNetwork, saveConfigJsonFromConfigTsFile, type GameType, type NetworkType } from "utils/environment";
import { type Chain } from "../utils/utils";

const VALID_GAME_TYPES: GameType[] = ["blitz", "eternum"];
const gameType = process.argv[2] as GameType;
if (!gameType || !VALID_GAME_TYPES.includes(gameType)) {
  console.error(`Usage: bun run ./scripts/add-quest-games.ts <game_type>`);
  console.error(`  game_type must be one of: ${VALID_GAME_TYPES.join(", ")}`);
  process.exit(1);
}

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

// prompt user to confirm non-local deployment
confirmNonLocalDeployment(VITE_PUBLIC_CHAIN!);
await saveConfigJsonFromConfigTsFile(VITE_PUBLIC_CHAIN! as NetworkType, gameType);
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);

const manifest = await getGameManifest(VITE_PUBLIC_CHAIN! as Chain);
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);
const account = new Account({
  provider: provider.provider,
  address: VITE_PUBLIC_MASTER_ADDRESS!,
  signer: VITE_PUBLIC_MASTER_PRIVATE_KEY!,
});
const config: EternumConfig = await nodeReadConfig(VITE_PUBLIC_CHAIN! as Chain, gameType);

const quest_games = config.questGames;

console.log(
  chalk.cyan(`
  ┌─ ${chalk.yellow("Add Quest Games")}
  ${quest_games
    .map(
      (quest_game) => `
  │  ${chalk.gray("Address:")} ${chalk.white(quest_game.address)}
  │  ${chalk.gray("Levels:")} ${chalk.white(quest_game.levels.map((level) => `${level.target_score} ${level.settings_id} ${level.time_limit}`).join(", "))}
  │  ${chalk.gray("Overwrite:")} ${chalk.white(quest_game.overwrite)}
  `,
    )
    .join("")}
  └────────────────────────────────`),
);

const txQuestGames = await provider.set_quest_games({
  signer: account,
  quest_games,
});
if (txQuestGames) {
  console.log(chalk.green(`    ✔ Quest Games added `) + chalk.gray(txQuestGames.statusReceipt));
} else {
  console.log(chalk.red(`    ✘ Quest Games failed `));
}
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
