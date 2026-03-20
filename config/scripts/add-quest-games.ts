import type { Config as EternumConfig } from "@bibliothecadao/types";
import chalk from "chalk";
import { nodeReadConfig } from "deployer/config";
import { logNetwork } from "utils/environment";
import { createQuestCommandContext, resolveQuestGameTypeArg } from "./quest-command-context";

const gameType = resolveQuestGameTypeArg(process.argv);
const context = await createQuestCommandContext(gameType);
const config: EternumConfig = await nodeReadConfig(context.network, gameType);
const questGames = config.questGames;

function renderQuestGamesPreview() {
  return chalk.cyan(`
  ┌─ ${chalk.yellow("Add Quest Games")}
  ${questGames
    .map(
      (questGame) => `
  │  ${chalk.gray("Address:")} ${chalk.white(questGame.address)}
  │  ${chalk.gray("Levels:")} ${chalk.white(questGame.levels.map((level) => `${level.target_score} ${level.settings_id} ${level.time_limit}`).join(", "))}
  │  ${chalk.gray("Overwrite:")} ${chalk.white(questGame.overwrite)}
  `,
    )
    .join("")}
  └────────────────────────────────`);
}

console.log(renderQuestGamesPreview());

const transaction = await context.provider.set_quest_games({
  signer: context.account,
  quest_games: questGames,
});

if (transaction) {
  console.log(chalk.green(`    ✔ Quest Games added `) + chalk.gray(transaction.statusReceipt));
} else {
  console.log(chalk.red(`    ✘ Quest Games failed `));
}

logNetwork(context.network);
