import { getSeasonAddresses } from "@contracts";
import chalk from "chalk";
import cliCursor from "cli-cursor";
import fs from "fs";
import logUpdate from "log-update";
import { RpcProvider } from "starknet";
import { Worker as NodeWorker } from "worker_threads";
import { CONFIG, summary, workerStatus } from "./config";
import { processLordsMinting } from "./lords-process";
import { determineRealmCounts, setupCleanupHandler, updateStatusDisplay } from "./utils";

export async function initializeWorldPopulation(provider: RpcProvider) {
  let activeWorkers: NodeWorker[] = [];
  setupCleanupHandler(() => activeWorkers);

  console.log(chalk.cyan.bold("\n=== STARTING WORLD POPULATION ==="));
  console.log(chalk.cyan("Configuration:"));
  console.log(chalk.cyan(JSON.stringify(CONFIG, null, 2)));

  const response = await provider.fetch("dev_predeployedAccounts");
  const addresses = getSeasonAddresses("local");
  const accounts = (
    (await response.json()) as unknown as {
      result: { address: string; privateKey: string }[];
    }
  ).result;
  const adminAccount = accounts[0];

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

  console.log(chalk.cyan.bold("\n=== STARTING PARALLEL PROCESSING FOR ALL ACCOUNTS ==="));

  await processWorkers(accountsData, addresses, adminAccount);

  console.log(chalk.cyan.bold("\n=== CONTINUING WITH LORDS MINTING ==="));

  const lordsMintingInterval = setInterval(() => {
    updateStatusDisplay(accountsData);
  }, 500);

  await processLordsMinting(provider, adminAccount, accountsData);

  clearInterval(lordsMintingInterval);
  logUpdate.clear();
  cliCursor.show();

  generateFinalReport();
}

async function processWorkers(
  accountsData: { account: any; realmCount: number; startRealmId: number }[],
  addresses: any,
  adminAccount: { address: string; privateKey: string },
) {
  const workers: NodeWorker[] = [];
  const workerPromises: Promise<void>[] = [];

  for (let i = 0; i < accountsData.length; i++) {
    const { account, realmCount, startRealmId } = accountsData[i];
    const shortAddress = account.address.substring(0, 8) + "...";

    workerStatus[account.address] = {
      stage: "initializing",
      lastUpdate: new Date(),
    };

    console.log(chalk.green(`Creating worker thread for account ${i + 1}/${accountsData.length} (${shortAddress})`));

    const worker = new NodeWorker(__filename, {
      workerData: {
        account,
        addresses,
        startRealmId,
        realmCount,
        adminAccount,
      },
    });

    workers.push(worker);

    const workerPromise = new Promise<void>((resolve) => {
      worker.on("message", (message) => {
        handleWorkerMessage(message, i, accountsData);
        if (message.type === "complete" || message.type === "error") {
          resolve();
        }
      });

      worker.on("error", (error) => {
        workerStatus[account.address] = {
          stage: "error",
          lastUpdate: new Date(),
        };

        console.log(chalk.red(`Worker error for account ${shortAddress}: ${error}`));
        summary.errors.push(`Worker error for account ${shortAddress}: ${error}`);
        updateStatusDisplay(accountsData);
        resolve();
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          workerStatus[account.address] = {
            stage: "crashed",
            lastUpdate: new Date(),
          };

          console.log(chalk.red(`Worker for account ${shortAddress} exited with code ${code}`));
          updateStatusDisplay(accountsData);
        }
        resolve();
      });
    });

    workerPromises.push(workerPromise);
  }

  cliCursor.hide();

  const statusInterval = setInterval(() => {
    updateStatusDisplay(accountsData);
  }, 5000);

  console.log(chalk.cyan(`Waiting for all ${workers.length} worker threads to complete...`));
  await Promise.all(workerPromises);

  clearInterval(statusInterval);
  logUpdate.clear();
}

function handleWorkerMessage(message: any, workerIndex: number, accountsData: any[]) {
  const accountCount = accountsData.length;

  switch (message.type) {
    case "progress":
      workerStatus[message.address] = {
        stage: message.stage,
        completed: message.progress?.completed,
        total: message.progress?.total,
        lastUpdate: new Date(),
      };

      if (!message.progress) {
        updateStatusDisplay(accountsData);
      } else {
        updateStatusDisplay(accountsData);
      }
      break;

    case "complete":
      workerStatus[message.address] = {
        stage: "completed",
        lastUpdate: new Date(),
      };

      summary.totalRealmsCreated += message.realmsCreated;
      summary.realmsByAccount[message.address] = message.realmsCreated;

      if (message.armiesCreated) {
        summary.totalArmiesCreated = (summary.totalArmiesCreated || 0) + message.armiesCreated;
        summary.armiesByAccount = summary.armiesByAccount || {};
        summary.armiesByAccount[message.address] = message.armiesCreated;
      }

      if (message.explorersMoved) {
        summary.totalExplorersMoved = (summary.totalExplorersMoved || 0) + message.explorersMoved;
        summary.explorersByAccount = summary.explorersByAccount || {};
        summary.explorersByAccount[message.address] = message.explorersMoved;
      }

      updateStatusDisplay(accountsData);
      break;

    case "error":
      workerStatus[message.address] = {
        stage: "error",
        lastUpdate: new Date(),
      };

      console.log(chalk.red(`✗ [Account ${workerIndex + 1}/${accountCount}] ${message.message}`));
      summary.errors.push(message.error);

      updateStatusDisplay(accountsData);
      break;
  }
}

function generateFinalReport() {
  console.log(chalk.cyan.bold("\n=== FINAL STATUS SUMMARY ==="));

  console.log(chalk.magenta.bold("\n=== WORLD POPULATION COMPLETE ==="));
  if (CONFIG.spawnRealms) {
    console.log(chalk.magenta(`Total realms created: ${summary.totalRealmsCreated}`));
  }
  if (CONFIG.spawnExplorers) {
    console.log(chalk.magenta(`Total armies created: ${summary.totalArmiesCreated}`));
  }
  if (CONFIG.moveExplorers) {
    console.log(chalk.magenta(`Total explorers moved: ${summary.totalExplorersMoved || 0}`));
  }
  if (CONFIG.mintLords) {
    console.log(chalk.magenta(`Total Lords minted: ${summary.totalLordsAttached}`));

    if (summary.totalLordsAttached && summary.totalRealmsCreated) {
      const lordsPerRealm = Math.round(summary.totalLordsAttached / summary.totalRealmsCreated);
      console.log(chalk.magenta(`Lords per realm: ${lordsPerRealm}`));
    }
  }

  if (CONFIG.spawnRealms) {
    console.log(chalk.magenta("\nRealms by account:"));
    Object.entries(summary.realmsByAccount).forEach(([address, count]) => {
      console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} realms`));
    });
  }

  if (CONFIG.spawnExplorers && summary.armiesByAccount && Object.keys(summary.armiesByAccount).length > 0) {
    console.log(chalk.magenta("\nArmies by account:"));
    Object.entries(summary.armiesByAccount).forEach(([address, count]) => {
      console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} armies`));
    });
  }

  if (CONFIG.moveExplorers && summary.explorersByAccount && Object.keys(summary.explorersByAccount).length > 0) {
    console.log(chalk.magenta("\nExplorers moved by account:"));
    Object.entries(summary.explorersByAccount).forEach(([address, count]) => {
      console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} explorers`));
    });
  }

  if (CONFIG.mintLords && summary.lordsAttachedByAccount && Object.keys(summary.lordsAttachedByAccount).length > 0) {
    console.log(chalk.magenta("\nLords by account:"));
    Object.entries(summary.lordsAttachedByAccount).forEach(([address, count]) => {
      console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} Lords`));
    });
  }

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

export function calculateRealmSettlements(
  startRealmId: number,
  count: number,
): Array<{ side: number; layer: number; point: number }> {
  const settlements: Array<{ side: number; layer: number; point: number }> = [];

  // Calculate the relative position offset from the base CONFIG.startRealmId
  const relativeOffset = startRealmId - CONFIG.startRealmId;
  
  // Calculate all required settlements
  for (let i = 0; i < count; i++) {
    // Use the relative position for settlement calculation
    const position = relativeOffset + i;
    
    // Start with layer 2
    let layer = 2;
    let totalSpotsInPreviousLayers = 0;

    // Find which layer this position belongs to
    while (true) {
      // Each layer has 6 sides and (layer-1) points per side
      const spotsInCurrentLayer = 6 * (layer - 1);

      if (position < totalSpotsInPreviousLayers + spotsInCurrentLayer) {
        break;
      }

      totalSpotsInPreviousLayers += spotsInCurrentLayer;
      layer++;
    }

    // Calculate position within the found layer
    const positionInLayer = position - totalSpotsInPreviousLayers;

    // Calculate side (0-5) and point within the layer
    const side = positionInLayer % 6;
    const point = Math.floor(positionInLayer / 6);

    settlements.push({ side, layer, point });
  }

  return settlements;
}
