import chalk from "chalk";
import cliCursor from "cli-cursor";
import fs from "fs";
import logUpdate from "log-update";
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

  // Update the header to include both worker and Lords minting status
  lines.push(chalk.cyan.bold(`=== WORLD POPULATION STATUS ===`));
  lines.push(chalk.cyan(`Time: ${new Date().toLocaleTimeString()}`));
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
    totalArmiesToCreate += realmCount; // Each realm gets one army
    totalExplorersToMove += realmCount; // Each realm gets one explorer to move

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
      case "creating_buildings":
        statusColor = chalk.yellow;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
        }
        break;
      case "creating_armies":
        statusColor = chalk.blue;
        armiesInProgressAccounts++;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
          totalArmiesCreated += status.completed;
        }
        break;
      case "skipped_armies":
        statusColor = chalk.blue;
        statusText = "ARMIES SKIPPED";
        totalArmiesCreated += realmCount; // Count all armies as completed if skipped
        break;
      case "moving_explorers":
        statusColor = chalk.green;
        explorersInProgressAccounts++;
        if (status.completed !== undefined && status.total !== undefined) {
          const percent = Math.round((status.completed / status.total) * 100);
          progressText = ` ${createProgressBar(percent)} ${percent}% (${status.completed}/${status.total})`;
          totalExplorersMoved += status.completed;
        }
        break;
      case "skipped_movement":
        statusColor = chalk.green;
        statusText = "MOVEMENT SKIPPED";
        totalExplorersMoved += realmCount; // Count all explorers as moved if skipped
        break;
      case "waiting":
        statusColor = chalk.blue;
        break;
      case "waiting_for_lords":
        statusColor = chalk.magenta;
        statusText = "WAITING FOR LORDS";
        lordsWaitingAccounts++;
        // If we're waiting for lords, armies and explorers are completed
        totalArmiesCreated += realmCount;
        totalExplorersMoved += realmCount;
        break;
      case "processing_lords":
        statusColor = chalk.magenta;
        statusText = "MINTING LORDS";
        lordsInProgressAccounts++;
        // If we're processing lords, armies and explorers are completed
        totalArmiesCreated += realmCount;
        totalExplorersMoved += realmCount;
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

    // Calculate time since last update
    const timeSinceUpdate = Math.round((new Date().getTime() - status.lastUpdate.getTime()) / 1000);
    const timeText =
      timeSinceUpdate < 60
        ? `${timeSinceUpdate}s ago`
        : `${Math.floor(timeSinceUpdate / 60)}m ${timeSinceUpdate % 60}s ago`;

    lines.push(
      statusColor(
        `[Account ${index + 1}] ${shortAddress}: ${statusText.toUpperCase()}${progressText} (updated ${timeText})`,
      ),
    );
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
