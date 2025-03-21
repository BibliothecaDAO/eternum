import chalk from "chalk";
import cliCursor from "cli-cursor";
import fs from "fs";
import logUpdate from "log-update";
import { Worker } from "worker_threads";
import { CONFIG, summary, workerStatus } from "./config";

// Determine how many realms each account should create
export function determineRealmCounts(accountCount: number): number[] {
  const realmCounts: number[] = [];

  for (let i = 0; i < accountCount; i++) {
    if (i === 0) {
      // First account
      realmCounts.push(CONFIG.realmDistribution.firstAccount);
    } else if (i === accountCount - 1) {
      // Last account
      realmCounts.push(CONFIG.realmDistribution.lastAccount);
    } else {
      // Middle accounts - random number between min and max
      const count = Math.floor(
        Math.random() * (CONFIG.realmDistribution.middleAccountsMax - CONFIG.realmDistribution.middleAccountsMin + 1) +
          CONFIG.realmDistribution.middleAccountsMin,
      );
      realmCounts.push(count);
    }
  }

  return realmCounts;
}

export function updateStatusDisplay(accountsData: { account: any; realmCount: number; startRealmId: number }[]) {
  const content = generateStatusDisplay(accountsData);

  logUpdate(content);
}

export function logWorkerMessage(message: string, color: (text: string) => string) {
  logUpdate.clear();

  console.log(color(message));
}

export function createProgressBar(percent: number): string {
  const width = 20;
  const completed = Math.floor(width * (percent / 100));
  const remaining = width - completed;
  return "[" + "=".repeat(completed) + " ".repeat(remaining) + "]";
}

export function generateStatusDisplay(
  accountsData: { account: any; realmCount: number; startRealmId: number }[],
): string {
  const lines: string[] = [];

  lines.push("");

  let totalCompleted = 0;
  let totalRealms = 0;
  let completedWorkers = 0;
  let lordsCompletedAccounts = 0;
  let lordsInProgressAccounts = 0;
  let lordsWaitingAccounts = 0;
  let totalLordsMinted = 0;
  let totalLordsToMint = 0;
  let totalLordsCompleted = 0;
  let totalArmiesCreated = 0;
  let totalArmiesToCreate = 0;
  let armiesInProgressAccounts = 0;
  let totalExplorersMoved = 0;
  let totalExplorersToMove = 0;
  let explorersInProgressAccounts = 0;

  accountsData.forEach((data, index) => {
    const { account, realmCount } = data;
    const shortAddress = account.address.substring(0, 8) + "...";
    const status = workerStatus[account.address];

    totalRealms += realmCount;
    totalArmiesToCreate += realmCount;
    totalExplorersToMove += realmCount;

    if (!status) {
      lines.push(chalk.gray(`[Account ${index + 1}] ${shortAddress}: No status available`));
      return;
    }

    let statusColor = chalk.white;
    let statusText = status.stage;
    let progressText = "";

    switch (status.stage) {
      case "initializing":
        statusColor = chalk.gray;
        break;
      case "started":
        statusColor = chalk.cyan;
        break;
      case "creating_realms":
        statusColor = chalk.yellow;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
          totalCompleted += status.completed;
        }
        break;
      case "skipped_realms":
        statusColor = chalk.yellow;
        statusText = "REALMS SKIPPED";
        totalCompleted += realmCount; // Count all realms as completed if skipped
        break;
      case "leveling_up_realms":
        statusColor = chalk.yellow;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
        }
        // Count realms as created too when they're being leveled up
        totalCompleted += status.completed || 0;
        break;
      case "skipped_leveling_realms":
        statusColor = chalk.yellow;
        statusText = "LEVELING SKIPPED";
        // If we skipped leveling, the realms were created
        totalCompleted += realmCount;
        break;
      case "creating_buildings":
        statusColor = chalk.yellow;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
        }
        // Count realms as created too when buildings are being created
        totalCompleted += realmCount;
        break;
      case "creating_armies":
        statusColor = chalk.blue;
        armiesInProgressAccounts++;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
          totalArmiesCreated += status.completed;
        }
        // Count realms as created when armies are being created
        totalCompleted += realmCount;
        break;
      case "skipped_armies":
        statusColor = chalk.blue;
        statusText = "ARMIES SKIPPED";
        totalArmiesCreated += realmCount; // Count all armies as completed if skipped
        totalCompleted += realmCount; // Count all realms as created too
        break;
      case "moving_explorers":
        statusColor = chalk.green;
        explorersInProgressAccounts++;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
          totalExplorersMoved += status.completed;
        }
        // Count armies as created and realms too when explorers are being moved
        totalCompleted += realmCount;
        totalArmiesCreated += realmCount;
        break;
      case "skipped_movement":
        statusColor = chalk.green;
        statusText = "MOVEMENT SKIPPED";
        totalExplorersMoved += realmCount; // Count all explorers as moved if skipped
        totalArmiesCreated += realmCount; // Count all armies as created too
        totalCompleted += realmCount; // Count all realms as created too
        break;
      case "waiting":
        statusColor = chalk.blue;
        // Count previous steps as completed
        totalCompleted += realmCount;
        totalArmiesCreated += realmCount;
        totalExplorersMoved += realmCount;
        break;
      case "waiting_for_lords":
        statusColor = chalk.magenta;
        statusText = "WAITING FOR LORDS";
        lordsWaitingAccounts++;
        // If we're waiting for lords, armies and explorers are completed
        totalArmiesCreated += realmCount;
        totalExplorersMoved += realmCount;
        totalCompleted += realmCount;
        break;
      case "processing_lords":
        statusColor = chalk.magenta;
        statusText = "MINTING LORDS";
        lordsInProgressAccounts++;
        // If we're processing lords, armies and explorers are completed
        totalArmiesCreated += realmCount;
        totalExplorersMoved += realmCount;
        totalCompleted += realmCount;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
          totalLordsMinted += status.completed;
          totalLordsToMint += status.total;
        }
        break;
      case "lords_completed":
        statusColor = chalk.green;
        statusText = "LORDS COMPLETED";
        lordsCompletedAccounts++;
        totalLordsCompleted += realmCount; // Count all realms as having Lords completed
        totalArmiesCreated += realmCount; // Count all armies as completed
        totalExplorersMoved += realmCount; // Count all explorers as moved
        totalCompleted += realmCount; // Count all realms as created
        if (summary.lordsAttachedByAccount && summary.lordsAttachedByAccount[account.address]) {
          progressText = ` (${summary.lordsAttachedByAccount[account.address]} Lords)`;
        }
        break;
      case "completed":
        statusColor = chalk.green;
        statusText = "COMPLETED";
        completedWorkers++;
        totalCompleted += realmCount; // Count all realms as completed
        totalArmiesCreated += realmCount; // Count all armies as completed
        totalExplorersMoved += realmCount; // Count all explorers as moved
        break;
      case "error":
        statusColor = chalk.red;
        statusText = "ERROR";
        break;
      case "crashed":
        statusColor = chalk.red;
        statusText = "CRASHED";
        break;
    }

    lines.push(statusColor(`[Account ${index + 1}] ${shortAddress}: ${statusText.toUpperCase()}${progressText}`));
  });

  lines.push("");

  // Calculate overall progress including all steps
  const totalSteps =
    (CONFIG.spawnRealms ? 1 : 0) +
    (CONFIG.spawnExplorers ? 1 : 0) +
    (CONFIG.moveExplorers ? 1 : 0) +
    (CONFIG.mintLords ? 1 : 0);

  let totalTasks = totalRealms * totalSteps; // Each realm needs to go through the enabled steps

  // Calculate completed tasks based on enabled steps
  let completedTasks = 0;
  if (CONFIG.spawnRealms) completedTasks += totalCompleted;
  if (CONFIG.spawnExplorers) completedTasks += totalArmiesCreated;
  if (CONFIG.moveExplorers) completedTasks += totalExplorersMoved;
  if (CONFIG.mintLords) completedTasks += totalLordsCompleted;

  if (completedWorkers === accountsData.length) {
    // If all workers are done, count their tasks as complete for the enabled steps
    completedTasks = 0;
    if (CONFIG.spawnRealms) completedTasks += totalRealms;
    if (CONFIG.spawnExplorers) completedTasks += totalRealms;
    if (CONFIG.moveExplorers) completedTasks += totalRealms;
    if (CONFIG.mintLords) completedTasks += totalLordsCompleted;
  }

  const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const overallProgressBar = createProgressBar(overallPercent);

  lines.push(
    chalk.cyan.bold(
      `Overall Progress: ${overallProgressBar} ${overallPercent}% (${completedTasks}/${totalTasks} tasks)`,
    ),
  );

  // Add a description of what the progress represents
  let progressDescription = "Progress includes:";
  if (CONFIG.spawnRealms) progressDescription += " 1) Realm creation,";
  if (CONFIG.spawnExplorers) progressDescription += " 2) Army creation,";
  if (CONFIG.moveExplorers) progressDescription += " 3) Explorer movement,";
  if (CONFIG.mintLords) progressDescription += " 4) Lords minting";

  lines.push(chalk.cyan(progressDescription));

  lines.push(chalk.cyan.bold(`Completed Workers: ${completedWorkers}/${accountsData.length}`));

  // Add separate progress bars for each enabled step
  if (CONFIG.spawnRealms) {
    if (completedWorkers === accountsData.length) {
      // Realm creation is complete
      lines.push(chalk.yellow(`Realm Creation: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms)`));
    } else {
      // Realm creation is in progress
      const realmPercent = Math.round((totalCompleted / totalRealms) * 100) || 0;
      lines.push(
        chalk.yellow(
          `Realm Creation: ${createProgressBar(realmPercent)} ${realmPercent}% (${totalCompleted}/${totalRealms} realms)`,
        ),
      );
    }
  }

  // Realm level up progress
  if (CONFIG.levelUpRealms) {
    if (completedWorkers === accountsData.length) {
      // Level up is complete
      lines.push(chalk.yellow(`Realm Level Up: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms)`));
    } else {
      // Count realms that have been leveled up
      let leveledUpRealms = 0;
      accountsData.forEach(data => {
        const { account } = data;
        const status = workerStatus[account.address];
        if (status && (status.stage === "creating_buildings" || status.stage === "creating_armies" || 
                       status.stage === "moving_explorers" || status.stage === "completed" || 
                       status.stage === "lords_completed" || status.stage === "skipped_buildings" ||
                       status.stage === "skipped_armies" || status.stage === "skipped_movement" || 
                       status.stage === "waiting_for_lords" || status.stage === "processing_lords" ||
                       status.stage === "skipped_leveling_realms" || status.stage === "waiting")) {
          leveledUpRealms += data.realmCount;
        } else if (status && status.stage === "leveling_up_realms" && status.completed) {
          leveledUpRealms += status.completed;
        }
      });
      
      const levelUpPercent = Math.round((leveledUpRealms / totalRealms) * 100) || 0;
      lines.push(
        chalk.yellow(
          `Realm Level Up: ${createProgressBar(levelUpPercent)} ${levelUpPercent}% (${leveledUpRealms}/${totalRealms} realms)`,
        ),
      );
    }
  }

  // Building creation progress
  if (CONFIG.createBuildings) {
    if (completedWorkers === accountsData.length) {
      // Building creation is complete
      lines.push(
        chalk.yellow(
          `Building Creation: ${createProgressBar(100)} 100% (${totalRealms}/${totalRealms} realms with buildings)`,
        ),
      );
    } else {
      // Count realms that have buildings created
      let buildingRealms = 0;
      accountsData.forEach(data => {
        const { account } = data;
        const status = workerStatus[account.address];
        if (status && (status.stage === "creating_armies" || status.stage === "moving_explorers" || 
                      status.stage === "completed" || status.stage === "lords_completed" || 
                      status.stage === "skipped_armies" || status.stage === "skipped_movement" || 
                      status.stage === "waiting_for_lords" || status.stage === "processing_lords" ||
                      status.stage === "waiting" || status.stage === "skipped_buildings")) {
          buildingRealms += data.realmCount;
        } else if (status && status.stage === "creating_buildings" && status.completed) {
          buildingRealms += status.completed;
        }
      });
      
      const buildingPercent = Math.round((buildingRealms / totalRealms) * 100) || 0;
      lines.push(
        chalk.yellow(
          `Building Creation: ${createProgressBar(buildingPercent)} ${buildingPercent}% (${buildingRealms}/${totalRealms} realms with buildings)`,
        ),
      );
    }
  }

  // Army creation progress
  if (CONFIG.spawnExplorers) {
    const armyPercent = Math.round((totalArmiesCreated / totalArmiesToCreate) * 100) || 0;
    lines.push(
      chalk.blue(
        `Army Creation: ${createProgressBar(armyPercent)} ${armyPercent}% (${totalArmiesCreated}/${totalArmiesToCreate} armies)`,
      ),
    );
  }

  // Explorer movement progress
  if (CONFIG.moveExplorers) {
    const explorerPercent = Math.round((totalExplorersMoved / totalExplorersToMove) * 100) || 0;
    lines.push(
      chalk.green(
        `Explorer Movement: ${createProgressBar(explorerPercent)} ${explorerPercent}% (${totalExplorersMoved}/${totalExplorersToMove} explorers)`,
      ),
    );
  }

  // Lords minting progress
  if (CONFIG.mintLords) {
    // Count all realms that have completed the Lords minting process
    // or are at a later stage
    
    // For Lords, we need to specifically count realms that have completed the Lords process
    const lordsTotal = totalRealms; // Total realms that need Lords
    const lordsPercent = Math.round((totalLordsCompleted / lordsTotal) * 100) || 0;
    
    lines.push(
      chalk.magenta(
        `Lords Minting: ${createProgressBar(lordsPercent)} ${lordsPercent}% (${totalLordsCompleted}/${lordsTotal} realms)`,
      ),
    );
  }

  // Add Lords minting progress if any accounts are in that stage
  if (CONFIG.mintLords && (lordsCompletedAccounts > 0 || lordsInProgressAccounts > 0 || lordsWaitingAccounts > 0)) {
    lines.push("");
    lines.push(chalk.magenta.bold(`=== LORDS MINTING STATUS ===`));

    if (lordsInProgressAccounts > 0 && totalLordsToMint > 0) {
      const currentLordsPercent = Math.round((totalLordsMinted / totalLordsToMint) * 100) || 0;
      const lordsProgressBar = createProgressBar(currentLordsPercent);
      lines.push(
        chalk.magenta(
          `Current Account: ${lordsProgressBar} ${currentLordsPercent}% (${totalLordsMinted}/${totalLordsToMint} realms)`,
        ),
      );
    }

    lines.push(
      chalk.magenta(
        `Accounts Status: ${lordsCompletedAccounts} completed, ${lordsInProgressAccounts} in progress, ${lordsWaitingAccounts} waiting`,
      ),
    );
  }

  // Add Explorer movement status if any accounts are in that stage
  if (CONFIG.moveExplorers && explorersInProgressAccounts > 0) {
    lines.push("");
    lines.push(chalk.green.bold(`=== EXPLORER MOVEMENT STATUS ===`));
    lines.push(
      chalk.green(
        `Accounts Status: ${explorersInProgressAccounts} in progress, ${accountsData.length - explorersInProgressAccounts} waiting/completed`,
      ),
    );
  }

  return lines.join("\n");
}

export function setupCleanupHandler(getActiveWorkers: () => Worker[]) {
  process.on("SIGINT", () => cleanup(getActiveWorkers()));
  process.on("SIGTERM", () => cleanup(getActiveWorkers()));
  process.on("SIGHUP", () => cleanup(getActiveWorkers()));

  process.on("uncaughtException", (error) => {
    console.error(chalk.red.bold("\nUncaught Exception:"));
    console.error(chalk.red(error));
    cleanup(getActiveWorkers());
  });
}

function cleanup(activeWorkers: Worker[]) {
  console.log(chalk.yellow.bold("\n\nReceived termination signal. Cleaning up..."));

  logUpdate.clear();
  cliCursor.show();

  if (activeWorkers.length > 0) {
    console.log(chalk.yellow(`Terminating ${activeWorkers.length} worker threads...`));

    activeWorkers.forEach((worker, index) => {
      try {
        worker.terminate();
      } catch (error) {
        console.error(chalk.red(`Error terminating worker ${index}: ${error}`));
      }
    });
  }

  console.log(chalk.magenta.bold("\n=== PARTIAL COMPLETION SUMMARY ==="));
  console.log(chalk.magenta(`Realms created so far: ${summary.totalRealmsCreated}`));
  console.log(chalk.magenta(`Armies created so far: ${summary.totalArmiesCreated}`));

  if (CONFIG.logSummary) {
    fs.writeFileSync(
      CONFIG.summaryFile,
      JSON.stringify(
        {
          ...summary,
          partial: true,
          terminatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(chalk.blue(`\nPartial summary saved to ${CONFIG.summaryFile}`));
  }

  console.log(chalk.yellow("Exiting..."));
  process.exit(1);
}
