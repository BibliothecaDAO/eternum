import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest } from "@contracts";
import chalk from "chalk";
import { Account } from "starknet";
import { type Chain } from "../utils/utils";

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

const manifest = await getGameManifest(VITE_PUBLIC_CHAIN! as Chain);
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS!, VITE_PUBLIC_MASTER_PRIVATE_KEY!);

const quest_games = [
  {
    address: "0x25dd1faa4f94d1ddd523d7db4697c10a34a09d7b55b4758995a070fd9d61498",
    levels: [
      { target_score: 25, settings_id: 1, time_limit: 14400 },
      { target_score: 50, settings_id: 2, time_limit: 14400 },
      { target_score: 50, settings_id: 3, time_limit: 14400 },
      { target_score: 50, settings_id: 4, time_limit: 14400 },
    ],
    overwrite: true,
  },
];

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
