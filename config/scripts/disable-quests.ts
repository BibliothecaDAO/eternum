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

console.log(
  chalk.cyan(`
  ┌─ ${chalk.yellow("Disabling Quests")}
  └────────────────────────────────`),
);

const txQuestGames = await provider.disable_quests({
  signer: account,
});

if (txQuestGames) {
  console.log(chalk.green(`    ✔ Disabling Quests Success `) + chalk.gray(txQuestGames.statusReceipt));
} else {
  console.log(chalk.red(`    ✘ Disabling Quests Failed `));
}
