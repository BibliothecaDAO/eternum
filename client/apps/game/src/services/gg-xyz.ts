import { cairoShortStringToFelt } from "@dojoengine/torii-client";
import { Provider } from "starknet";
import { env } from "../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";
const starknetProvider = new Provider({ nodeUrl: env.VITE_PUBLIC_NODE_URL });

export interface ActionDispatcherResponse {
  success: boolean;
  message?: string;
}

export enum Achievements {
  REALM_SETTLEMENT = "REALM_SETTLEMENT",
  VILLAGE_SETTLEMENT = "VILLAGE_SETTLEMENT",
  EXPLORE = "EXPLORE",
  AGENT_DISCOVER = "AGENT_DISCOVER",
  QUEST_DISCOVER = "QUEST_DISCOVER",
  MINE_DISCOVER = "MINE_DISCOVER",
  HYPERSTRUCTURE_DISCOVER = "HYPERSTRUCTURE_DISCOVER",
  BIOME_DISCOVER = "BIOME_DISCOVER",
  RESOURCE_PRODUCE = "RESOURCE_PRODUCE",
  BUILD_STANDARD = "BUILD_STANDARD",
  BUILD_SIMPLE = "BUILD_SIMPLE",
  LABOR_PRODUCE = "LABOR_PRODUCE",
  WIN_BATTLE = "WIN_BATTLE",
  KILL_AGENT = "KILL_AGENT",
  UPGRADE_REALM = "UPGRADE_REALM",
  UPGRADE_VILLAGE = "UPGRADE_VILLAGE",
  JOIN_TRIBE = "JOIN_TRIBE",
  CONTRIBUTE_HYPERSTRUCTURE = "CONTRIBUTE_HYPERSTRUCTURE",
}

interface QuestThreshold {
  achievement: Achievements;
  threshold: number;
  action: string;
}

const QUEST_THRESHOLDS: Record<Achievements, QuestThreshold[]> = {
  [Achievements.REALM_SETTLEMENT]: [
    { achievement: Achievements.REALM_SETTLEMENT, threshold: 1, action: "Settle a Realm" },
  ],
  [Achievements.VILLAGE_SETTLEMENT]: [
    { achievement: Achievements.VILLAGE_SETTLEMENT, threshold: 1, action: "Settle a Village" },
  ],
  [Achievements.EXPLORE]: [
    { achievement: Achievements.EXPLORE, threshold: 1, action: "Explore 1 hex on the World Map" },
  ],
  // can do it 16 times for 16 different biomes
  [Achievements.BIOME_DISCOVER]: [
    { achievement: Achievements.BIOME_DISCOVER, threshold: 1, action: "Discover a new Biome" },
  ],
  [Achievements.AGENT_DISCOVER]: [
    { achievement: Achievements.AGENT_DISCOVER, threshold: 1, action: "Discover an Agent" },
  ],
  [Achievements.QUEST_DISCOVER]: [
    { achievement: Achievements.QUEST_DISCOVER, threshold: 1, action: "Discover a Quest Tile" },
  ],
  [Achievements.MINE_DISCOVER]: [
    { achievement: Achievements.MINE_DISCOVER, threshold: 1, action: "Discover a Fragment Mine" },
  ],
  [Achievements.HYPERSTRUCTURE_DISCOVER]: [
    {
      achievement: Achievements.HYPERSTRUCTURE_DISCOVER,
      threshold: 1,
      action: "Discover a Hyperstructure Foundation",
    },
  ],
  [Achievements.RESOURCE_PRODUCE]: [
    {
      achievement: Achievements.RESOURCE_PRODUCE,
      threshold: 50000,
      action: "Produce 50,000 resources",
    },
  ],
  [Achievements.BUILD_STANDARD]: [
    {
      achievement: Achievements.BUILD_STANDARD,
      threshold: 1,
      action: "Construct 1 building using the Standard construction mode",
    },
  ],
  [Achievements.BUILD_SIMPLE]: [
    {
      achievement: Achievements.BUILD_SIMPLE,
      threshold: 1,
      action: "Construct 1 building using the Simple construction mode",
    },
  ],
  [Achievements.LABOR_PRODUCE]: [
    { achievement: Achievements.LABOR_PRODUCE, threshold: 50000, action: "Produce 50,000 Labor" },
  ],
  [Achievements.WIN_BATTLE]: [{ achievement: Achievements.WIN_BATTLE, threshold: 1, action: "Win a battle" }],
  [Achievements.KILL_AGENT]: [{ achievement: Achievements.KILL_AGENT, threshold: 1, action: "Kill an Agent" }],
  [Achievements.UPGRADE_REALM]: [{ achievement: Achievements.UPGRADE_REALM, threshold: 1, action: "Upgrade a Realm" }],
  [Achievements.UPGRADE_VILLAGE]: [
    { achievement: Achievements.UPGRADE_VILLAGE, threshold: 1, action: "Upgrade a Village" },
  ],
  [Achievements.JOIN_TRIBE]: [{ achievement: Achievements.JOIN_TRIBE, threshold: 1, action: "Create or join a Tribe" }],
  [Achievements.CONTRIBUTE_HYPERSTRUCTURE]: [
    {
      achievement: Achievements.CONTRIBUTE_HYPERSTRUCTURE,
      threshold: 500_000,
      action: "Contribute 500,000 resources to a Hyperstructure",
    },
  ],
};

/**
 * Converts a CartridgeAchievement enum value to its corresponding felt252 value
 * and pads it to 66 characters (including 0x prefix)
 * @param achievement The CartridgeAchievement enum value
 * @returns The padded felt252 value as a string
 */
export function getTaskId(achievement: Achievements): string {
  const felt = cairoShortStringToFelt(achievement);
  // Remove 0x prefix if present
  const withoutPrefix = felt.startsWith("0x") ? felt.slice(2) : felt;
  // Pad with zeros to 64 characters (66 with 0x prefix)
  return "0x" + withoutPrefix.padStart(64, "0");
}

/**
 * Normalizes a player address to ensure it starts with '0x0'
 * @param address The player address to normalize
 * @returns The normalized address
 */
function normalizePlayerAddress(address: string): string {
  if (address.startsWith("0x")) {
    // If it starts with 0x but not 0x0, add the 0
    if (!address.startsWith("0x0")) {
      return "0x0" + address.slice(2);
    }
    return address;
  }
  // If it doesn't start with 0x at all, add 0x0
  return "0x0" + address;
}

/**
 * Normalizes a timestamp number to a 32-byte hex string with 0x prefix
 * @param timestamp The timestamp number to normalize
 * @returns The normalized timestamp as a hex string
 */
export function normalizeTimestamp(timestamp: number): string {
  // Convert to hex and remove '0x' prefix
  const hex = timestamp.toString(16);
  // Pad with zeros to 64 characters (32 bytes)
  return "0x" + hex.padStart(64, "0");
}

/**
 * Fetches trophy progression for multiple achievements in a single query
 * @param playerAddress The player's address
 * @param achievements Array of CartridgeAchievement enum values
 * @returns Promise with a map of achievement to count
 */
export async function fetchMultipleTrophyProgressions(
  playerAddress: string,
  blockTimestamp: number,
  achievements: Achievements[],
): Promise<Record<Achievements, number>> {
  const normalizedAddress = normalizePlayerAddress(playerAddress);
  const normalizedTimestamp = normalizeTimestamp(blockTimestamp);
  const taskIds = achievements.map((achievement) => `'${getTaskId(achievement)}'`).join(", ");

  const query = `
    SELECT
      task_id,
      time,
      SUM(count) as total_count
    FROM
      "s1_eternum-TrophyProgression"
    WHERE
      player_id = '${normalizedAddress}'
      AND task_id IN (${taskIds})
      AND time = '${normalizedTimestamp}'
    GROUP BY
      task_id,
      time
  `;

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`Failed to fetch trophy progressions: ${response.statusText}`);
  }

  const data: { task_id: string; total_count: number; time: number }[] = await response.json();

  // Create a map to store the results
  const result: Record<Achievements, number> = {} as Record<Achievements, number>;

  // Initialize all achievements with 0 count
  achievements.forEach((achievement) => {
    result[achievement] = 0;
  });

  // Update with actual counts from the query
  data.forEach((item) => {
    // Find the achievement that corresponds to this task_id
    for (const achievement of achievements) {
      if (getTaskId(achievement) === item.task_id) {
        result[achievement] = item.total_count || 0;
        break;
      }
    }
  });

  console.log({ blockTimestamp, result });

  return result;
}

/**
 * Dispatch actions to the GG.xyz API endpoint through our secure backend
 * @param actions Array of action strings to dispatch
 * @param playerAddress The player's address
 * @returns Promise with the API response
 */
export async function dispatchActions(actions: string[], playerAddress: string): Promise<ActionDispatcherResponse> {
  const API_URL = env.VITE_PUBLIC_ACTION_DISPATCHER_URL;
  const API_SECRET = env.VITE_PUBLIC_ACTION_DISPATCHER_SECRET;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      secret: API_SECRET,
    },
    body: JSON.stringify({
      actions,
      playerAddress: playerAddress,
    }),
  });

  if (!response.ok) {
    console.error(`Failed to dispatch actions: ${response.statusText}`);
  } else {
    console.log(`Actions dispatched: ${actions.join(", ")}`);
  }

  return await response.json();
}

/**
 * Gets the block timestamp from a transaction hash
 * @param txHash The transaction hash to get the block timestamp from
 * @returns Promise with the block timestamp
 */
export async function getBlockTimestampFromTxHash(txHash: string): Promise<number> {
  let blockNumber: number | undefined;

  const getTransactionReceipt = async () => {
    const response = await fetch(env.VITE_PUBLIC_NODE_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "starknet_getTransactionReceipt",
        params: [txHash],
        id: 1,
        jsonrpc: "2.0",
      }),
    });
    const data = await response.json();
    return data;
  };

  let receipt;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    receipt = await getTransactionReceipt();
    if (receipt?.result?.block_number) {
      blockNumber = receipt.result.block_number;
      break;
    }
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  if (!blockNumber) {
    throw new Error(`Failed to get block number for transaction ${txHash} after ${maxAttempts} attempts`);
  }

  const block = await starknetProvider.getBlock(blockNumber);
  return block.timestamp;
}

/**
 * Checks quest progression for multiple achievements and dispatches actions when thresholds are met
 * @param playerAddress The player's address
 * @param achievements Array of CartridgeAchievement enum values
 * @returns Promise with the dispatched actions
 */
export async function checkAndDispatchMultipleGgXyzQuestProgress(
  playerAddress: string,
  txHash: string,
  achievements: Achievements[],
): Promise<Record<Achievements, string[]>> {
  const blockTimestamp = await getBlockTimestampFromTxHash(txHash);

  const progressions = await fetchMultipleTrophyProgressions(playerAddress, blockTimestamp, achievements);
  const completedActionsByAchievement: Record<Achievements, string[]> = {} as Record<Achievements, string[]>;
  const allCompletedActions: string[] = [];

  // Process each achievement
  for (const achievement of achievements) {
    const currentCount = progressions[achievement] || 0;
    const thresholds = QUEST_THRESHOLDS[achievement];
    const achievementCompletedActions: string[] = [];

    // Check thresholds for this achievement
    for (const threshold of thresholds) {
      if (currentCount >= threshold.threshold) {
        achievementCompletedActions.push(threshold.action);
        allCompletedActions.push(threshold.action);
      }
    }

    completedActionsByAchievement[achievement] = achievementCompletedActions;
  }

  // Dispatch all completed actions at once
  if (allCompletedActions.length > 0) {
    await dispatchActions(allCompletedActions, playerAddress);
  }

  return completedActionsByAchievement;
}
