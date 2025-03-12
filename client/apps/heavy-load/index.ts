import { getSeasonAddresses } from "@contracts";
import chalk from "chalk";
import fs from "fs";
import { Account, RpcProvider } from "starknet";
import { CONFIG, summary, SYSTEM_ADDRESSES } from "./src/config";
import { getRealmEntityIds } from "./src/queries";
import { createExplorerArmy, createRealm, mintLords } from "./src/system-calls";
import { determineRealmCounts } from "./src/utils";

const provider = new RpcProvider({ nodeUrl: CONFIG.nodeUrl });

// parallelize for each account
// reach 1m entities

// torii toml config (auto indexing for models)
// Create manual indexes for specific entries of models (ex x and y of position (we use > x greater than))

// cache size toml config

async function runWorldPopulation() {
  console.log(chalk.cyan.bold("\n=== STARTING WORLD POPULATION ==="));
  console.log(chalk.cyan("Configuration:"));
  console.log(chalk.cyan(JSON.stringify(CONFIG, null, 2)));

  const response = await provider.fetch("dev_predeployedAccounts");
  const accounts = (
    (await response.json()) as unknown as {
      result: { address: string; privateKey: string }[];
    }
  ).result;

  const addresses = getSeasonAddresses("local");
  let realmId = CONFIG.startRealmId;
  const realmCounts = determineRealmCounts(accounts.length);
  const accountsData: { account: any; realmCount: number; startRealmId: number }[] = [];

  console.log(chalk.yellow("\nRealm Distribution Plan:"));
  accounts.forEach((account, index) => {
    const shortAddress = account.address.substring(0, 8) + "...";
    console.log(chalk.yellow(`Account ${index} (${shortAddress}): ${realmCounts[index]} realms`));
    accountsData.push({
      account,
      realmCount: realmCounts[index],
      startRealmId: realmId,
    });
    realmId += realmCounts[index];
  });

  // PHASE 1: Create all realms
  console.log(chalk.cyan.bold("\n=== PHASE 1: CREATING REALMS ==="));
  for (let i = 0; i < accountsData.length; i++) {
    const { account, realmCount, startRealmId } = accountsData[i];
    const shortAddress = account.address.substring(0, 8) + "...";

    console.log(chalk.green(`\n[${i + 1}/${accounts.length}] Processing account ${shortAddress}`));
    console.log(chalk.green(`Creating ${realmCount} realms starting from ID ${startRealmId}`));

    await createRealmsForAccount(account, addresses, SYSTEM_ADDRESSES.realmSystems, startRealmId, realmCount);
  }

  // Wait for transactions to be processed
  console.log(chalk.cyan.bold("\n=== WAITING FOR TRANSACTIONS TO BE PROCESSED ==="));
  console.log(chalk.cyan("Waiting 30 seconds..."));
  await new Promise((resolve) => setTimeout(resolve, 30000));

  // PHASE 2: Add Lords and armies
  console.log(chalk.cyan.bold("\n=== PHASE 2: ADDING LORDS AND ARMIES ==="));
  const adminAccount = accounts[0];
  const adminAccountObject = new Account(provider, adminAccount.address, adminAccount.privateKey);

  for (let i = 0; i < accountsData.length; i++) {
    const { account } = accountsData[i];
    const shortAddress = account.address.substring(0, 8) + "...";
    const accountObject = new Account(provider, account.address, account.privateKey);

    console.log(chalk.green(`\n[${i + 1}/${accounts.length}] Processing account ${shortAddress}`));

    // Get realm entity IDs for this account
    const realmEntityIds = await getRealmEntityIds(accountObject);
    console.log(chalk.green(`Found ${realmEntityIds.length} realms for account ${shortAddress}`));

    // Process each realm
    for (let j = 0; j < realmEntityIds.length; j++) {
      const realmEntityId = realmEntityIds[j];
      process.stdout.write(chalk.blue(`\rProcessing realm ${j + 1}/${realmEntityIds.length} [ID: ${realmEntityId}]`));

      try {
        await mintLords(adminAccountObject, SYSTEM_ADDRESSES.devResourceSystems, realmEntityId);
        await createExplorerArmy(accountObject, realmEntityId);
        summary.totalLordsAttached += CONFIG.lordsPerRealm;
      } catch (error) {
        const errorMsg = `Error processing realm ${realmEntityId}: ${error}`;
        console.error(chalk.red(`\n${errorMsg}`));
        summary.errors.push(errorMsg);
      }
    }

    console.log(chalk.green(`\n✓ Completed processing ${realmEntityIds.length} realms for account ${shortAddress}`));
  }

  // // PHASE 3: Move explorers
  // console.log(chalk.cyan.bold("\n=== PHASE 3: MOVING EXPLORERS ==="));
  // const explorerEntityIds = await getExplorerEntityIds();
  // console.log(chalk.green(`Found ${explorerEntityIds.length} explorers`));

  // for (let i = 0; i < explorerEntityIds.length; i++) {
  //   const explorerEntityId = explorerEntityIds[i];
  //   await explorerMove(accountObject, explorerEntityId);

  // Log summary
  console.log(chalk.magenta.bold("\n=== WORLD POPULATION COMPLETE ==="));
  console.log(chalk.magenta(`Total realms created: ${summary.totalRealmsCreated}`));
  console.log(chalk.magenta(`Total Lords attached: ${summary.totalLordsAttached}`));
  console.log(chalk.magenta("Realms by account:"));
  Object.entries(summary.realmsByAccount).forEach(([address, count]) => {
    console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} realms`));
  });

  if (summary.errors.length > 0) {
    console.log(chalk.red(`\nErrors encountered: ${summary.errors.length}`));
    summary.errors.forEach((error, i) => {
      if (i < 5) console.log(chalk.red(`  ${error}`));
    });
    if (summary.errors.length > 5) {
      console.log(chalk.red(`  ... and ${summary.errors.length - 5} more errors`));
    }
  }

  if (CONFIG.logSummary) {
    fs.writeFileSync(CONFIG.summaryFile, JSON.stringify(summary, null, 2));
    console.log(chalk.blue(`\nSummary saved to ${CONFIG.summaryFile}`));
  }
}

async function createRealmsForAccount(
  account: { address: string; privateKey: string },
  addresses: any,
  realmSystemsContractAddress: string,
  startRealmId: number,
  realmCount: number,
) {
  const accountObject = new Account(provider, account.address, account.privateKey);
  summary.realmsByAccount[account.address] = 0;

  // Create realms in batches to avoid transaction size limits
  const BATCH_SIZE = 5;
  const totalBatches = Math.ceil(realmCount / BATCH_SIZE);

  // Progress tracking
  let completedRealms = 0;
  const shortAddress = account.address.substring(0, 8) + "...";

  for (let i = 0; i < realmCount; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, realmCount - i);
    const batchStartId = startRealmId + i;
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    try {
      process.stdout.write(
        chalk.blue(`\rProcessing batch ${batchNumber}/${totalBatches} [${completedRealms}/${realmCount} realms]`),
      );

      // Create realms in this batch
      for (let j = 0; j < batchSize; j++) {
        const currentRealmId = batchStartId + j;

        await createRealm(accountObject, addresses, realmSystemsContractAddress, currentRealmId);

        summary.totalRealmsCreated++;
        summary.realmsByAccount[account.address]++;
        completedRealms++;
      }

      // Update progress after each batch
      process.stdout.write(
        chalk.blue(`\rProcessing batch ${batchNumber}/${totalBatches} [${completedRealms}/${realmCount} realms]`),
      );
    } catch (error) {
      const errorMsg = `Error creating realms for account ${shortAddress} batch ${batchNumber}/${totalBatches}: ${error}`;
      console.error(chalk.red(`\n${errorMsg}`));
      summary.errors.push(errorMsg);
    }
  }

  // Final log for this account
  console.log(chalk.green(`\n✓ Account ${shortAddress} completed: ${completedRealms}/${realmCount} realms created`));
}

// Run the world population
runWorldPopulation().catch((error) => {
  console.error(chalk.red.bold("\nFatal error:"));
  console.error(chalk.red(error));
});
