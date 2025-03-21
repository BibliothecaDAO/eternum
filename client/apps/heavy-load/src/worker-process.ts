import { Account } from "starknet";
import { parentPort } from "worker_threads";
import { provider } from "..";
import { CONFIG } from "./config";
import { getRealmEntityIds } from "./queries";
import {
  executeCreateBuildings,
  executeCreateExplorerArmies,
  executeCreateMarketOrders,
  executeLevelUpRealms,
  executeMoveExplorers,
  executeRealmCreation,
  reportProgress,
} from "./worker-steps";

export async function workerProcess(
  account: { address: string; privateKey: string },
  addresses: any,
  startRealmId: number,
  realmCount: number,
) {
  try {
    reportProgress(account, "started", `Worker for account ${account.address.substring(0, 8)}... started`);

    const accountObject = new Account(provider, account.address, account.privateKey);
    let armiesCreated = 0;
    let explorersMoved = 0;
    let realmsCreated = 0;
    let ordersCreated = 0;

    if (CONFIG.spawnRealms) {
      realmsCreated = await executeRealmCreation(account, accountObject, addresses, startRealmId, realmCount);
    } else {
      reportProgress(
        account,
        "skipped_realms",
        `Skipped creating realms for account ${account.address.substring(0, 8)}...`,
      );
    }

    const realmEntityIds = await getRealmEntityIds(accountObject);

    if (CONFIG.levelUpRealms) {
      await executeLevelUpRealms(account, accountObject);
    } else {
      reportProgress(
        account,
        "skipped_leveling_realms",
        `Skipped leveling up realms for account ${account.address.substring(0, 8)}...`,
      );
    }

    if (CONFIG.createBuildings) {
      await executeCreateBuildings(account, accountObject);
    } else {
      reportProgress(
        account,
        "skipped_buildings",
        `Skipped creating buildings for account ${account.address.substring(0, 8)}...`,
      );
    }

    if (CONFIG.spawnExplorers) {
      armiesCreated = await executeCreateExplorerArmies(account, accountObject);
    } else {
      armiesCreated = realmEntityIds.length;
      reportProgress(
        account,
        "skipped_armies",
        `Skipped creating armies for account ${account.address.substring(0, 8)}...`,
      );
    }

    if (CONFIG.moveExplorers) {
      explorersMoved = await executeMoveExplorers(account, accountObject, realmEntityIds);
    } else {
      reportProgress(
        account,
        "skipped_movement",
        `Skipped moving explorers for account ${account.address.substring(0, 8)}...`,
      );
    }

    if (CONFIG.createMarketOrders) {
      ordersCreated = await executeCreateMarketOrders(account, accountObject);
    } else {
      reportProgress(
        account,
        "skipped_orders",
        `Skipped creating market orders for account ${account.address.substring(0, 8)}...`
      );
    }

    parentPort?.postMessage({
      type: "complete",
      success: true,
      address: account.address,
      realmsCreated: realmsCreated,
      armiesCreated: armiesCreated,
      explorersMoved: explorersMoved,
      ordersCreated: ordersCreated,
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
