import { Account } from "starknet";
import { parentPort } from "worker_threads";
import { CONFIG } from "./config";
import { getExplorerEntityIds, getRealmEntityIds } from "./queries";
import { createBuildings, createExplorerArmy, createRealm, levelUpRealms, moveExplorer } from "./system-calls";

export function reportProgress(
  account: { address: string; privateKey: string },
  stage: string,
  message: string,
  progress?: { completed: number; total: number },
) {
  parentPort?.postMessage({
    type: "progress",
    address: account.address,
    stage,
    progress,
    message,
  });
}

export async function executeRealmCreation(
  account: { address: string; privateKey: string },
  accountObject: Account,
  addresses: any,
  startRealmId: number,
  realmCount: number,
) {
  reportProgress(
    account,
    "creating_realms",
    `Creating ${realmCount} realms for account ${account.address.substring(0, 8)}...`,
  );

  const realmSettlements = calculateRealmSettlements(startRealmId, realmCount);

  const BATCH_SIZE = 5;
  let completedRealms = 0;

  for (let i = 0; i < realmCount; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, realmCount - i);
    const batchStartId = startRealmId + i;

    for (let j = 0; j < batchSize; j++) {
      const currentRealmId = batchStartId + j;
      const settlementIndex = i + j;
      const realmSettlement = realmSettlements[settlementIndex];

      await createRealm(accountObject, addresses, currentRealmId, realmSettlement);
      completedRealms++;

      reportProgress(
        account,
        "creating_realms",
        `Created ${completedRealms}/${realmCount} realms for account ${account.address.substring(0, 8)}...`,
        { completed: completedRealms, total: realmCount },
      );
    }
  }

  return completedRealms;
}

export async function executeLevelUpRealms(account: { address: string; privateKey: string }, accountObject: Account) {
  reportProgress(account, "leveling_up_realms", `Leveling up realms for account ${account.address.substring(0, 8)}...`);

  const realmEntityIds = await getRealmEntityIds(accountObject);
  let completedLevelUps = 0;

  for (let j = 0; j < realmEntityIds.length; j++) {
    const realmEntityId = realmEntityIds[j];

    try {
      await levelUpRealms(accountObject, realmEntityId);
      completedLevelUps++;

      reportProgress(
        account,
        "leveling_up_realms",
        `Leveled up ${j + 1}/${realmEntityIds.length} realms for account ${account.address.substring(0, 8)}...`,
        { completed: j + 1, total: realmEntityIds.length },
      );
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

  return completedLevelUps;
}

export async function executeCreateBuildings(account: { address: string; privateKey: string }, accountObject: Account) {
  reportProgress(account, "creating_buildings", `Creating buildings for account ${account.address.substring(0, 8)}...`);

  const realmEntityIds = await getRealmEntityIds(accountObject);
  let completedBuildings = 0;

  for (let j = 0; j < realmEntityIds.length; j++) {
    const realmEntityId = realmEntityIds[j];

    try {
      await createBuildings(accountObject, realmEntityId);
      completedBuildings++;

      reportProgress(
        account,
        "creating_buildings",
        `Created buildings for ${j + 1}/${realmEntityIds.length} realms for account ${account.address.substring(0, 8)}...`,
        { completed: j + 1, total: realmEntityIds.length },
      );
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

  return completedBuildings;
}

export async function executeCreateExplorerArmies(
  account: { address: string; privateKey: string },
  accountObject: Account,
) {
  reportProgress(
    account,
    "creating_armies",
    `Creating explorer armies for account ${account.address.substring(0, 8)}...`,
  );

  const realmEntityIds = await getRealmEntityIds(accountObject);
  let armiesCreated = 0;

  for (let j = 0; j < realmEntityIds.length; j++) {
    const realmEntityId = realmEntityIds[j];

    try {
      await createExplorerArmy(accountObject, realmEntityId);
      armiesCreated++;

      reportProgress(
        account,
        "creating_armies",
        `Created ${j + 1}/${realmEntityIds.length} armies for account ${account.address.substring(0, 8)}...`,
        { completed: j + 1, total: realmEntityIds.length },
      );
    } catch (error) {}
  }

  return armiesCreated;
}

export async function executeMoveExplorers(
  account: { address: string; privateKey: string },
  accountObject: Account,
  realmEntityIds: number[],
) {
  reportProgress(account, "moving_explorers", `Moving explorers for account ${account.address.substring(0, 8)}...`);

  let explorersMoved = 0;

  try {
    const explorerEntityIds = await getExplorerEntityIds(realmEntityIds);

    if (explorerEntityIds.length === 0) {
      reportProgress(
        account,
        "moving_explorers",
        `No explorers found for account ${account.address.substring(0, 8)}...`,
      );
      return explorersMoved;
    }

    for (let j = 0; j < explorerEntityIds.length; j++) {
      try {
        const explorerEntityId = explorerEntityIds[j];
        await moveExplorer(accountObject, explorerEntityId);
        explorersMoved++;

        reportProgress(
          account,
          "moving_explorers",
          `Moved ${j + 1}/${explorerEntityIds.length} explorers for account ${account.address.substring(0, 8)}...`,
          { completed: j + 1, total: explorerEntityIds.length },
        );
      } catch (error) {}
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

  return explorersMoved;
}

/**
 * Calculate realm settlement locations based on total realms and starting ID
 * - Side: between 0 and 5
 * - Layer: starting at 2, increment whenever all sides and points have been settled
 * - Point: starts at 0, up to (layer - 2)
 */
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
