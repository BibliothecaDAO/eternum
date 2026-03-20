import chalk from "chalk";
import { logNetwork } from "utils/environment";
import { createQuestCommandContext, resolveQuestGameTypeArg } from "./quest-command-context";

const gameType = resolveQuestGameTypeArg(process.argv);
const context = await createQuestCommandContext(gameType);

console.log(
  chalk.cyan(`
  ┌─ ${chalk.yellow("Disabling Quests")}
  └────────────────────────────────`),
);

const transaction = await context.provider.disable_quests({
  signer: context.account,
});

if (transaction) {
  console.log(chalk.green(`    ✔ Disabling Quests Success `) + chalk.gray(transaction.statusReceipt));
} else {
  console.log(chalk.red(`    ✘ Disabling Quests Failed `));
}

logNetwork(context.network);
