import chalk from "chalk";
import { RpcProvider } from "starknet";
import { isMainThread, parentPort, workerData } from "worker_threads";
import { CONFIG } from "./src/config";
import { workerProcess } from "./src/worker-process";
import { initializeWorldPopulation } from "./src/world-population";

export const provider = new RpcProvider({ nodeUrl: CONFIG.nodeUrl });

if (!isMainThread) {
  const { account, addresses, startRealmId, realmCount } = workerData;

  workerProcess(account, addresses, startRealmId, realmCount).catch((error) => {
    parentPort?.postMessage({
      type: "error",
      success: false,
      address: account.address,
      error: String(error),
      message: `Fatal error in worker: ${error}`,
    });
  });
} else {
  initializeWorldPopulation(provider).catch((error) => {
    console.error(chalk.red.bold("\nFatal error:"));
    console.error(chalk.red(error));
  });
}
