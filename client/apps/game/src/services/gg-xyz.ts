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
  RESOURCE_PRODUCE = "RESOURCE_PRODUCE",
  BUILD_STANDARD = "BUILD_STANDARD",
  BUILD_SIMPLE = "BUILD_SIMPLE",
  LABOR_PRODUCE = "LABOR_PRODUCE",
  WIN_BATTLE = "WIN_BATTLE",
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
    { achievement: CartridgeAchievement.EXPLORE, threshold: 50, action: "Explore 50 hexes on the World Map" },
    { achievement: CartridgeAchievement.EXPLORE, threshold: 250, action: "Explore 250 hexes on the World Map" },
    { achievement: CartridgeAchievement.EXPLORE, threshold: 1000, action: "Explore 1000 hexes on the World Map" },
  ],
  [CartridgeAchievement.RESOURCE_PRODUCE]: [
    {
      achievement: CartridgeAchievement.RESOURCE_PRODUCE,
      threshold: 10_000_000,
      action: "Produce 10,000,000 resources",
    },
    {
      achievement: CartridgeAchievement.RESOURCE_PRODUCE,
      threshold: 100_000_000,
      action: "Produce 100,000,000 resources",
    },
    {
      achievement: CartridgeAchievement.RESOURCE_PRODUCE,
      threshold: 1_000_000_000,
      action: "Produce 1,000,000,000 resources",
    },
  ],
  [CartridgeAchievement.BUILD_STANDARD]: [
    {
      achievement: CartridgeAchievement.BUILD_STANDARD,
      threshold: 10,
      action: "Construct 10 buildings using the Standard construction mode",
    },
    {
      achievement: CartridgeAchievement.BUILD_STANDARD,
      threshold: 25,
      action: "Construct 25 buildings using the Standard construction mode",
    },
    {
      achievement: CartridgeAchievement.BUILD_STANDARD,
      threshold: 50,
      action: "Construct 50 buildings using the Standard construction mode",
    },
  ],
  [CartridgeAchievement.BUILD_SIMPLE]: [
    {
      achievement: CartridgeAchievement.BUILD_SIMPLE,
      threshold: 10,
      action: "Construct 10 buildings using the Simple construction mode",
    },
    {
      achievement: CartridgeAchievement.BUILD_SIMPLE,
      threshold: 25,
      action: "Construct 25 buildings using the Simple construction mode",
    },
    {
      achievement: CartridgeAchievement.BUILD_SIMPLE,
      threshold: 50,
      action: "Construct 50 buildings using the Simple construction mode",
    },
  ],
  [CartridgeAchievement.LABOR_PRODUCE]: [
    { achievement: CartridgeAchievement.LABOR_PRODUCE, threshold: 1_000_000, action: "Produce 1,000,000 Labor" },
    { achievement: CartridgeAchievement.LABOR_PRODUCE, threshold: 10_000_000, action: "Produce 10,000,000 Labor" },
    { achievement: CartridgeAchievement.LABOR_PRODUCE, threshold: 100_000_000, action: "Produce 100,000,000 Labor" },
  ],
  [CartridgeAchievement.WIN_BATTLE]: [
    { achievement: CartridgeAchievement.WIN_BATTLE, threshold: 1, action: "Win your first battle" },
    { achievement: CartridgeAchievement.WIN_BATTLE, threshold: 10, action: "Win 10 battles" },
    { achievement: CartridgeAchievement.WIN_BATTLE, threshold: 25, action: "Win 25 battles" },
  ],
  [CartridgeAchievement.UPGRADE_REALM]: [
    { achievement: CartridgeAchievement.UPGRADE_REALM, threshold: 1, action: "Upgrade a Realm to a City" },
    { achievement: CartridgeAchievement.UPGRADE_REALM, threshold: 2, action: "Upgrade a Realm to a Kingdom" },
    { achievement: CartridgeAchievement.UPGRADE_REALM, threshold: 3, action: "Upgrade a Realm to an Empire" },
  ],
  [CartridgeAchievement.UPGRADE_VILLAGE]: [
    { achievement: CartridgeAchievement.UPGRADE_VILLAGE, threshold: 1, action: "Upgrade a Village to a City" },
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
    {
      achievement: CartridgeAchievement.CONTRIBUTE_HYPERSTRUCTURE,
      threshold: 5_000_000,
      action: "Contribute 5,000,000 resources to a Hyperstructure",
    },
    {
      achievement: CartridgeAchievement.CONTRIBUTE_HYPERSTRUCTURE,
      threshold: 50_000_000,
      action: "Contribute 50,000,000 resources to a Hyperstructure",
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
  console.log({ taskId });
  const query = `
    SELECT
      SUM(count) as total_count
    FROM
      "s1_eternum-TrophyProgression"
    WHERE
      player_id = '${normalizedAddress}'
      AND task_id = '${taskId}'
  `;

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch trophy progression: ${response.statusText}`);
  }

  const data: { total_count: number }[] = await response.json();
  return data[0]?.total_count || 0;
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
    throw new Error(`Failed to dispatch actions: ${response.statusText}`);
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
