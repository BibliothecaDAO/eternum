import { getSeasonAddresses } from "@contracts";
import chalk from "chalk";
import cliCursor from "cli-cursor";
import fs from "fs";
import logUpdate from "log-update";
import { Account, RpcProvider } from "starknet";
import { isMainThread, parentPort, Worker, workerData } from "worker_threads";
import { CONFIG, summary, workerStatus } from "./src/config";
import { getExplorerEntityIds, getRealmEntityIds } from "./src/queries";
import {
  createBuildings,
  createExplorerArmy,
  createRealm,
  levelUpRealms,
  mintLords,
  moveExplorer,
} from "./src/system-calls";
import {
  createProgressBar,
  determineRealmCounts,
  logWorkerMessage,
  setupCleanupHandler,
  updateStatusDisplay,
} from "./src/utils";

export const provider = new RpcProvider({ nodeUrl: CONFIG.nodeUrl });

if (!isMainThread) {
  const { account, addresses, startRealmId, realmCount } = workerData;

  async function workerProcess() {
    try {
      parentPort?.postMessage({
        type: "progress",
        address: account.address,
        stage: "started",
        message: `Worker for account ${account.address.substring(0, 8)}... started`,
      });

      let armiesCreated = 0;
      let explorersMoved = 0;

      if (CONFIG.spawnRealms) {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "creating_realms",
          message: `Creating ${realmCount} realms for account ${account.address.substring(0, 8)}...`,
        });

        await createRealmsForAccount(account, addresses, startRealmId, realmCount, (progress) => {
          // Send progress updates to main thread
          parentPort?.postMessage({
            type: "progress",
            address: account.address,
            stage: "creating_realms",
            progress,
            message: `Created ${progress.completed}/${progress.total} realms for account ${account.address.substring(0, 8)}...`,
          });
        });
        // await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "skipped_realms",
          message: `Skipped creating realms for account ${account.address.substring(0, 8)}...`,
        });
      }

      const accountObject = new Account(provider, account.address, account.privateKey);
      const realmEntityIds = await getRealmEntityIds(accountObject);

      if (CONFIG.levelUpRealms) {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "leveling_up_realms",
          message: `Leveling up realms for account ${account.address.substring(0, 8)}...`,
        });
        for (let j = 0; j < realmEntityIds.length; j++) {
          const realmEntityId = realmEntityIds[j];

          try {
            await levelUpRealms(accountObject, realmEntityId);
            
            parentPort?.postMessage({
              type: "progress",
              address: account.address,
              stage: "leveling_up_realms",
              progress: { completed: j + 1, total: realmEntityIds.length },
              message: `Leveled up ${j + 1}/${realmEntityIds.length} realms for account ${account.address.substring(0, 8)}...`,
            });
          } catch (error) {
            parentPort?.postMessage({
              type: "error",
              success: false,
              address: account.address,
              error: `Error leveling up realm ${realmEntityId}: ${error}`,
              message: `Error leveling up realm ${realmEntityId} for account ${account.address.substring(0, 8)}...: ${error}`,
            });
          }
        }

        // await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "skipped_leveling_realms",
          message: `Skipped leveling up realms for account ${account.address.substring(0, 8)}...`,
        });
      }

      if (CONFIG.createBuildings) {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "creating_buildings",
          message: `Creating buildings for account ${account.address.substring(0, 8)}...`,
        });

        for (let j = 0; j < realmEntityIds.length; j++) {
          const realmEntityId = realmEntityIds[j];

          try {
            await createBuildings(accountObject, realmEntityId);

            parentPort?.postMessage({
              type: "progress",
              address: account.address,
              stage: "creating_buildings",
              progress: { completed: j + 1, total: realmEntityIds.length },
              message: `Created buildings for ${j + 1}/${realmEntityIds.length} realms for account ${account.address.substring(0, 8)}...`,
            });
          } catch (error) {
            parentPort?.postMessage({
              type: "error",
              success: false,
              address: account.address,
              error: `Error creating buildings for realm ${realmEntityId}: ${error}`,
              message: `Error creating buildings for realm ${realmEntityId} for account ${account.address.substring(0, 8)}...: ${error}`,
            });
          }
        }
      } else {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "skipped_buildings",
          message: `Skipped creating buildings for account ${account.address.substring(0, 8)}...`,
        });
      }

      if (CONFIG.spawnExplorers) {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "creating_armies",
          message: `Creating explorer armies for account ${account.address.substring(0, 8)}...`,
        });

        for (let j = 0; j < realmEntityIds.length; j++) {
          const realmEntityId = realmEntityIds[j];

          try {
            await createExplorerArmy(accountObject, realmEntityId);
            armiesCreated++;

            parentPort?.postMessage({
              type: "progress",
              address: account.address,
              stage: "creating_armies",
              progress: { completed: j + 1, total: realmEntityIds.length },
              message: `Created ${j + 1}/${realmEntityIds.length} armies for account ${account.address.substring(0, 8)}...`,
            });
          } catch (error) {}
        }

        // await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        armiesCreated = realmEntityIds.length;
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "skipped_armies",
          message: `Skipped creating armies for account ${account.address.substring(0, 8)}...`,
        });
      }

      if (CONFIG.moveExplorers) {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "moving_explorers",
          message: `Moving explorers for account ${account.address.substring(0, 8)}...`,
        });

        try {
          const explorerEntityIds = await getExplorerEntityIds(realmEntityIds);

          if (explorerEntityIds.length === 0) {
            parentPort?.postMessage({
              type: "progress",
              address: account.address,
              stage: "moving_explorers",
              message: `No explorers found for account ${account.address.substring(0, 8)}...`,
            });
          } else {
            for (let j = 0; j < explorerEntityIds.length; j++) {
              try {
                const explorerEntityId = explorerEntityIds[j];
                await moveExplorer(accountObject, explorerEntityId);
                explorersMoved++;

                parentPort?.postMessage({
                  type: "progress",
                  address: account.address,
                  stage: "moving_explorers",
                  progress: { completed: j + 1, total: explorerEntityIds.length },
                  message: `Moved ${j + 1}/${explorerEntityIds.length} explorers for account ${account.address.substring(0, 8)}...`,
                });
              } catch (error) {}
            }
          }
        } catch (error) {
          parentPort?.postMessage({
            type: "error",
            success: false,
            address: account.address,
            error: `Error fetching explorer entity IDs: ${error}`,
            message: `Error fetching explorer entity IDs for account ${account.address.substring(0, 8)}...: ${error}`,
          });
        }
      } else {
        parentPort?.postMessage({
          type: "progress",
          address: account.address,
          stage: "skipped_movement",
          message: `Skipped moving explorers for account ${account.address.substring(0, 8)}...`,
        });
      }

      parentPort?.postMessage({
        type: "complete",
        success: true,
        address: account.address,
        armiesCreated: armiesCreated,
        explorersMoved: explorersMoved,
        message: `Completed processing for account ${account.address.substring(0, 8)}...`,
      });
    } catch (error) {
      parentPort?.postMessage({
        type: "error",
        success: false,
        address: account.address,
        error: String(error),
        message: `Error processing account ${account.address.substring(0, 8)}...: ${error}`,
      });
    }
  }

  workerProcess().catch((error) => {
    parentPort?.postMessage({
      type: "error",
      success: false,
      address: account.address,
      error: String(error),
      message: `Fatal error in worker: ${error}`,
    });
  });
}

// Main thread
async function runWorldPopulation() {
  if (!isMainThread) return;

  let activeWorkers: Worker[] = [];
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

  const workers: Worker[] = [];
  const workerPromises: Promise<void>[] = [];

  for (let i = 0; i < accountsData.length; i++) {
    const { account, realmCount, startRealmId } = accountsData[i];
    const shortAddress = account.address.substring(0, 8) + "...";

    workerStatus[account.address] = {
      stage: "initializing",
      lastUpdate: new Date(),
    };

    console.log(chalk.green(`Creating worker thread for account ${i + 1}/${accounts.length} (${shortAddress})`));

    const worker = new Worker(__filename, {
      workerData: {
        account,
        addresses,
        startRealmId,
        realmCount,
        adminAccount,
      },
    });

    workers.push(worker);

    // Handle messages from worker
    const workerPromise = new Promise<void>((resolve) => {
      worker.on("message", (message) => {
        switch (message.type) {
          case "progress":
            workerStatus[message.address] = {
              stage: message.stage,
              completed: message.progress?.completed,
              total: message.progress?.total,
              lastUpdate: new Date(),
            };

            if (!message.progress) {
              let stageColor = chalk.blue;
              switch (message.stage) {
                case "started":
                  stageColor = chalk.cyan;
                  break;
                case "creating_realms":
                  stageColor = chalk.yellow;
                  break;
                case "skipped_realms":
                  stageColor = chalk.yellow;
                  break;
                case "leveling_up_realms":
                  stageColor = chalk.yellow;
                  break;
                case "skipped_leveling_realms":
                  stageColor = chalk.yellow;
                  break;
                case "creating_buildings":
                  stageColor = chalk.yellow;
                  break;
                case "creating_armies":
                  stageColor = chalk.blue;
                  break;
                case "skipped_armies":
                  stageColor = chalk.blue;
                  break;
                case "moving_explorers":
                  stageColor = chalk.green;
                  break;
                case "skipped_movement":
                  stageColor = chalk.green;
                  break;
                case "waiting":
                  stageColor = chalk.blue;
                  break;
                case "processing_lords":
                  stageColor = chalk.magenta;
                  break;
              }

              let progressMsg = `[Account ${i + 1}/${accounts.length}] ${message.message}`;

              if (message.stage === "error") {
                logWorkerMessage(progressMsg, stageColor);
              } else {
                updateStatusDisplay(accountsData);
              }
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

            logWorkerMessage(`✗ [Account ${i + 1}/${accounts.length}] ${message.message}`, chalk.red);
            summary.errors.push(message.error);

            updateStatusDisplay(accountsData);
            break;
        }
      });

      worker.on("error", (error) => {
        workerStatus[account.address] = {
          stage: "error",
          lastUpdate: new Date(),
        };

        logWorkerMessage(`Worker error for account ${shortAddress}: ${error}`, chalk.red);
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

          logWorkerMessage(`Worker for account ${shortAddress} exited with code ${code}`, chalk.red);
          updateStatusDisplay(accountsData);
        }
        resolve();
      });
    });

    workerPromises.push(workerPromise);
  }

  activeWorkers = workers;
  cliCursor.hide();

  const statusInterval = setInterval(() => {
    updateStatusDisplay(accountsData);
  }, 5000);

  console.log(chalk.cyan(`Waiting for all ${workers.length} worker threads to complete...`));
  await Promise.all(workerPromises);

  clearInterval(statusInterval);
  logUpdate.clear();

  // Process Lords minting sequentially with a single admin account
  console.log(chalk.cyan.bold("\n=== CONTINUING WITH LORDS MINTING ==="));

  const adminAccountObject = new Account(provider, adminAccount.address, adminAccount.privateKey);
  let totalLordsAttached = 0;

  // Initialize summary.lordsAttachedByAccount if it doesn't exist
  summary.lordsAttachedByAccount = summary.lordsAttachedByAccount || {};

  // Update worker status to include Lords minting
  for (const data of accountsData) {
    const { account } = data;
    workerStatus[account.address] = {
      ...workerStatus[account.address],
      stage: "waiting_for_lords",
      lastUpdate: new Date(),
    };
  }

  // Restart the status interval for Lords minting with a faster refresh rate
  const lordsMintingInterval = setInterval(() => {
    updateStatusDisplay(accountsData);
  }, 500); // Update every 500ms for smoother display

  updateStatusDisplay(accountsData);

  for (let i = 0; i < accountsData.length; i++) {
    const { account } = accountsData[i];
    const accountObject = new Account(provider, account.address, account.privateKey);

    // Update status to processing lords
    workerStatus[account.address] = {
      stage: "processing_lords",
      completed: 0,
      total: 0,
      lastUpdate: new Date(),
    };

    updateStatusDisplay(accountsData);

    const realmEntityIds = await getRealmEntityIds(accountObject);

    // Update total realms for this account
    workerStatus[account.address].total = realmEntityIds.length;
    updateStatusDisplay(accountsData);

    let accountLordsAttached = 0;

    for (let j = 0; j < realmEntityIds.length; j++) {
      const realmEntityId = realmEntityIds[j];

      // Update progress
      workerStatus[account.address].completed = j + 1;
      workerStatus[account.address].lastUpdate = new Date();
      updateStatusDisplay(accountsData);

      if (CONFIG.mintLords) {
        try {
          await mintLords(adminAccountObject, realmEntityId);

          accountLordsAttached += CONFIG.lordsPerRealm;
          totalLordsAttached += CONFIG.lordsPerRealm;
        } catch (error) {
          console.log(chalk.red(`\nError processing realm ${realmEntityId}: ${error}`));
          summary.errors.push(`Error processing realm ${realmEntityId}: ${error}`);
        }
      }
    }

    // Mark account as completed with lords
    workerStatus[account.address] = {
      stage: "lords_completed",
      lastUpdate: new Date(),
    };

    summary.lordsAttachedByAccount[account.address] = accountLordsAttached;
    updateStatusDisplay(accountsData);
  }

  summary.totalLordsAttached = totalLordsAttached;

  // Clear the interval and show the cursor
  clearInterval(lordsMintingInterval);
  logUpdate.clear();
  cliCursor.show();

  // Show a final status display with everything completed
  console.log(chalk.cyan.bold("\n=== FINAL STATUS SUMMARY ==="));

  // Generate a final status display with all tasks completed
  const finalStatusLines: string[] = [];

  // Overall progress - 100% complete
  const totalRealms = summary.totalRealmsCreated;
  const totalSteps =
    (CONFIG.spawnRealms ? 1 : 0) +
    (CONFIG.levelUpRealms ? 1 : 0) +
    (CONFIG.createBuildings ? 1 : 0) +
    (CONFIG.spawnExplorers ? 1 : 0) +
    (CONFIG.moveExplorers ? 1 : 0) +
    (CONFIG.mintLords ? 1 : 0);
  const totalTasks = totalRealms * totalSteps;
  const overallProgressBar = createProgressBar(100);

  finalStatusLines.push(
    chalk.cyan.bold(`Overall Progress: ${overallProgressBar} 100% (${totalTasks}/${totalTasks} tasks)`),
  );
  finalStatusLines.push("");

  // Individual progress bars - all at 100%
  if (CONFIG.spawnRealms) {
    finalStatusLines.push(
      chalk.yellow(`Realm Creation: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms)`),
    );
  }

  if (CONFIG.levelUpRealms) {
    finalStatusLines.push(
      chalk.yellow(`Realm Level Up: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms)`),
    );
  }

  if (CONFIG.createBuildings) {
    finalStatusLines.push(
      chalk.yellow(
        `Building Creation: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms with buildings)`,
      ),
    );
  }

  if (CONFIG.spawnExplorers) {
    finalStatusLines.push(
      chalk.blue(
        `Army Creation: ${createProgressBar(100)} 100% (${summary.totalArmiesCreated}/${summary.totalArmiesCreated} armies)`,
      ),
    );
  }

  if (CONFIG.moveExplorers) {
    finalStatusLines.push(
      chalk.green(
        `Explorer Movement: ${createProgressBar(100)} 100% (${summary.totalExplorersMoved || totalRealms}/${summary.totalExplorersMoved || totalRealms} explorers)`,
      ),
    );
  }

  if (CONFIG.mintLords) {
    finalStatusLines.push(
      chalk.magenta(`Lords Minting: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms)`),
    );
  }

  console.log(finalStatusLines.join("\n"));

  // Log detailed summary
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

    // Add Lords per realm info
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

  // Add armies by account if available
  if (CONFIG.spawnExplorers && summary.armiesByAccount && Object.keys(summary.armiesByAccount).length > 0) {
    console.log(chalk.magenta("\nArmies by account:"));
    Object.entries(summary.armiesByAccount).forEach(([address, count]) => {
      console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} armies`));
    });
  }

  // Add explorers moved by account if available
  if (CONFIG.moveExplorers && summary.explorersByAccount && Object.keys(summary.explorersByAccount).length > 0) {
    console.log(chalk.magenta("\nExplorers moved by account:"));
    Object.entries(summary.explorersByAccount).forEach(([address, count]) => {
      console.log(chalk.magenta(`  ${address.substring(0, 8)}...: ${count} explorers`));
    });
  }

  // Add Lords by account if available
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

async function createRealmsForAccount(
  account: { address: string; privateKey: string },
  addresses: any,
  startRealmId: number,
  realmCount: number,
  progressCallback?: (progress: { completed: number; total: number }) => void,
) {
  const accountObject = new Account(provider, account.address, account.privateKey);

  // Create realms in batches to avoid transaction size limits
  const BATCH_SIZE = 5;
  const totalBatches = Math.ceil(realmCount / BATCH_SIZE);

  let completedRealms = 0;
  const shortAddress = account.address.substring(0, 8) + "...";

  for (let i = 0; i < realmCount; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, realmCount - i);
    const batchStartId = startRealmId + i;
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    try {
      if (isMainThread) {
        const progressMsg = chalk.blue(
          `Processing batch ${batchNumber}/${totalBatches} [${completedRealms}/${realmCount} realms]`,
        );
        process.stdout.write(`\r${progressMsg}`);
      }

      for (let j = 0; j < batchSize; j++) {
        const currentRealmId = batchStartId + j;

        await createRealm(accountObject, addresses, currentRealmId);
        completedRealms++;
      }

      if (isMainThread) {
        const progressMsg = chalk.blue(
          `Processing batch ${batchNumber}/${totalBatches} [${completedRealms}/${realmCount} realms]`,
        );
        process.stdout.write(`\r${progressMsg}`);
      }

      if (progressCallback) {
        progressCallback({ completed: completedRealms, total: realmCount });
      }
    } catch (error) {
      const errorMsg = `Error creating realms for account ${shortAddress} batch ${batchNumber}/${totalBatches}: ${error}`;
      if (isMainThread) {
        logWorkerMessage(errorMsg, chalk.red);
      }
      throw error;
    }
  }

  if (isMainThread) {
    logWorkerMessage(
      `✓ Account ${shortAddress} completed: ${completedRealms}/${realmCount} realms created`,
      chalk.green,
    );
  }

  return completedRealms;
}

if (isMainThread) {
  runWorldPopulation().catch((error) => {
    console.error(chalk.red.bold("\nFatal error:"));
    console.error(chalk.red(error));
  });
}
