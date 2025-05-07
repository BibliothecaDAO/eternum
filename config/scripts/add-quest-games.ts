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
    address: "0x444834e7b71749832f0db8c64f17ed1c3af8462c1682c10dcd6068b1c57494b",
    levels: [
      { target_score: 26, settings_id: 1, time_limit: 86400 },
      { target_score: 51, settings_id: 2, time_limit: 86400 },
      { target_score: 51, settings_id: 3, time_limit: 86400 },
      { target_score: 51, settings_id: 4, time_limit: 86400 },
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
