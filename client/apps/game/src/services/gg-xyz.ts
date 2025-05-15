import { cairoShortStringToFelt } from "@dojoengine/torii-client";
import { env } from "../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";

export interface ActionDispatcherResponse {
  success: boolean;
  message?: string;
}

export interface TrophyProgression {
  count: number;
}

export enum CartridgeAchievement {
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
  achievement: CartridgeAchievement;
  threshold: number;
  action: string;
}

const QUEST_THRESHOLDS: Record<CartridgeAchievement, QuestThreshold[]> = {
  [CartridgeAchievement.REALM_SETTLEMENT]: [
    { achievement: CartridgeAchievement.REALM_SETTLEMENT, threshold: 1, action: "Settle a Realm" },
  ],
  [CartridgeAchievement.VILLAGE_SETTLEMENT]: [
    { achievement: CartridgeAchievement.VILLAGE_SETTLEMENT, threshold: 1, action: "Settle a Village" },
  ],
  [CartridgeAchievement.EXPLORE]: [
    { achievement: CartridgeAchievement.EXPLORE, threshold: 1, action: "Explore 1 hex on the World Map" },
  ],
  // can do it 16 times for 16 different biomes
  [CartridgeAchievement.BIOME_DISCOVER]: [
    { achievement: CartridgeAchievement.BIOME_DISCOVER, threshold: 1, action: "Discover a new Biome" },
  ],
  [CartridgeAchievement.AGENT_DISCOVER]: [
    { achievement: CartridgeAchievement.AGENT_DISCOVER, threshold: 1, action: "Discover an Agent" },
  ],
  [CartridgeAchievement.QUEST_DISCOVER]: [
    { achievement: CartridgeAchievement.QUEST_DISCOVER, threshold: 1, action: "Discover a Quest Tile" },
  ],
  [CartridgeAchievement.MINE_DISCOVER]: [
    { achievement: CartridgeAchievement.MINE_DISCOVER, threshold: 1, action: "Discover a Fragment Mine" },
  ],
  [CartridgeAchievement.HYPERSTRUCTURE_DISCOVER]: [
    {
      achievement: CartridgeAchievement.HYPERSTRUCTURE_DISCOVER,
      threshold: 1,
      action: "Discover a Hyperstructure Foundation",
    },
  ],
  [CartridgeAchievement.RESOURCE_PRODUCE]: [
    {
      achievement: CartridgeAchievement.RESOURCE_PRODUCE,
      threshold: 50000,
      action: "Produce 50,000 resources",
    },
  ],
  [CartridgeAchievement.BUILD_STANDARD]: [
    {
      achievement: CartridgeAchievement.BUILD_STANDARD,
      threshold: 1,
      action: "Construct 1 building using the Standard construction mode",
    },
  ],
  [CartridgeAchievement.BUILD_SIMPLE]: [
    {
      achievement: CartridgeAchievement.BUILD_SIMPLE,
      threshold: 1,
      action: "Construct 1 building using the Simple construction mode",
    },
  ],
  [CartridgeAchievement.LABOR_PRODUCE]: [
    { achievement: CartridgeAchievement.LABOR_PRODUCE, threshold: 50000, action: "Produce 50,000 Labor" },
  ],
  [CartridgeAchievement.WIN_BATTLE]: [
    { achievement: CartridgeAchievement.WIN_BATTLE, threshold: 1, action: "Win a battle" },
  ],
  [CartridgeAchievement.KILL_AGENT]: [
    { achievement: CartridgeAchievement.KILL_AGENT, threshold: 1, action: "Kill an Agent" },
  ],
  [CartridgeAchievement.UPGRADE_REALM]: [
    { achievement: CartridgeAchievement.UPGRADE_REALM, threshold: 1, action: "Upgrade a Realm" },
  ],
  [CartridgeAchievement.UPGRADE_VILLAGE]: [
    { achievement: CartridgeAchievement.UPGRADE_VILLAGE, threshold: 1, action: "Upgrade a Village" },
  ],
  [CartridgeAchievement.JOIN_TRIBE]: [
    { achievement: CartridgeAchievement.JOIN_TRIBE, threshold: 1, action: "Create or join a Tribe" },
  ],
  [CartridgeAchievement.CONTRIBUTE_HYPERSTRUCTURE]: [
    {
      achievement: CartridgeAchievement.CONTRIBUTE_HYPERSTRUCTURE,
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
export function getTaskId(achievement: CartridgeAchievement): string {
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
 * Fetches the total count of trophy progression for a specific task and player
 * @param playerAddress The player's address
 * @param achievement The CartridgeAchievement enum value
 * @returns Promise with the total count
 */
export async function fetchTrophyProgression(
  playerAddress: string,
  achievement: CartridgeAchievement,
): Promise<number> {
  const normalizedAddress = normalizePlayerAddress(playerAddress);
  const taskId = getTaskId(achievement);
  const query = `
    SELECT
      SUM(count) as total_count
    FROM
      "s1_eternum-TrophyProgression"
    WHERE
      player_id = '${normalizedAddress}'
      AND task_id = '${taskId}'
  `;
  console.log({ query });

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch trophy progression: ${response.statusText}`);
  }

  const data: { total_count: number }[] = await response.json();
  return data[0]?.total_count || 0;
}

/**
 * Fetches trophy progression for multiple achievements in a single query
 * @param playerAddress The player's address
 * @param achievements Array of CartridgeAchievement enum values
 * @returns Promise with a map of achievement to count
 */
export async function fetchMultipleTrophyProgressions(
  playerAddress: string,
  achievements: CartridgeAchievement[],
): Promise<Record<CartridgeAchievement, number>> {
  const normalizedAddress = normalizePlayerAddress(playerAddress);
  const taskIds = achievements.map((achievement) => `'${getTaskId(achievement)}'`).join(", ");

  const query = `
    SELECT
      task_id,
      SUM(count) as total_count
    FROM
      "s1_eternum-TrophyProgression"
    WHERE
      player_id = '${normalizedAddress}'
      AND task_id IN (${taskIds})
    GROUP BY
      task_id
  `;

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`Failed to fetch trophy progressions: ${response.statusText}`);
  }

  const data: { task_id: string; total_count: number }[] = await response.json();

  // Create a map to store the results
  const result: Record<CartridgeAchievement, number> = {} as Record<CartridgeAchievement, number>;

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

  console.log({ result });

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
  }

  return await response.json();
}

/**
 * Checks quest progression and dispatches actions when thresholds are met
 * @param playerAddress The player's address
 * @param achievement The CartridgeAchievement enum value
 * @param newCount The new count to be added
 * @returns Promise with the dispatched actions
 */
export async function checkAndDispatchGgXyzQuestProgress(
  playerAddress: string,
  achievement: CartridgeAchievement,
): Promise<string[]> {
  const currentCount = await fetchTrophyProgression(playerAddress, achievement);

  const thresholds = QUEST_THRESHOLDS[achievement];
  const completedActions: string[] = [];

  for (const threshold of thresholds) {
    // Check if we've just reached or exceeded this threshold
    if (currentCount >= threshold.threshold) {
      completedActions.push(threshold.action);
    }
  }

  if (completedActions.length > 0) {
    await dispatchActions(completedActions, playerAddress);
  }

  return completedActions;
}

/**
 * Checks quest progression for multiple achievements and dispatches actions when thresholds are met
 * @param playerAddress The player's address
 * @param achievements Array of CartridgeAchievement enum values
 * @returns Promise with the dispatched actions
 */
export async function checkAndDispatchMultipleGgXyzQuestProgress(
  playerAddress: string,
  achievements: CartridgeAchievement[],
): Promise<Record<CartridgeAchievement, string[]>> {
  const progressions = await fetchMultipleTrophyProgressions(playerAddress, achievements);
  const completedActionsByAchievement: Record<CartridgeAchievement, string[]> = {} as Record<
    CartridgeAchievement,
    string[]
  >;
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
