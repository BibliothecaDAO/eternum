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
  BIOME_DISCOVER = "BIOME_DISCOVER",
  AGENT_DISCOVER = "AGENT_DISCOVER",
  QUEST_DISCOVER = "QUEST_DISCOVER",
  MINE_DISCOVER = "MINE_DISCOVER",
  HYPERSTRUCTURE_DISCOVER = "HYPERSTRUCTURE_DISCOVER",
  RESOURCE_PRODUCE = "RESOURCE_PRODUCE",
  BUILD_STANDARD = "BUILD_STANDARD",
  BUILD_SIMPLE = "BUILD_SIMPLE",
  LABOR_PRODUCE = "LABOR_PRODUCE",
  KILL_AGENT = "KILL_AGENT",
  BRIDGE_LORDS = "BRIDGE_LORDS",
  WIN_BATTLE = "WIN_BATTLE",
  PRODUCE_T2 = "PRODUCE_T2",
  PRODUCE_T3 = "PRODUCE_T3",
  WIN_BIOME_BATTLE = "WIN_BIOME_BATTLE",
  SUCCESSFUL_RAID = "SUCCESSFUL_RAID",
  DEFEND_STRUCTURE = "DEFEND_STRUCTURE",
  UPGRADE_REALM = "UPGRADE_REALM",
  UPGRADE_VILLAGE = "UPGRADE_VILLAGE",
  JOIN_TRIBE = "JOIN_TRIBE",
  CONTRIBUTE_HYPERSTRUCTURE = "CONTRIBUTE_HYPERSTRUCTURE",
  WIN_GAME = "WIN_GAME",
  VICTORY_POINTS = "VICTORY_POINTS",
}

/**
 * Converts a CartridgeAchievement enum value to its corresponding felt252 value
 * @param achievement The CartridgeAchievement enum value
 * @returns The felt252 value as a string
 */
export function getTaskId(achievement: CartridgeAchievement): string {
  return cairoShortStringToFelt(achievement);
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
  const taskId = getTaskId(achievement);
  const query = `
    SELECT
      SUM(count) as total_count
    FROM
      "s1_eternum-TrophyProgression"
    WHERE
      player_id = '${playerAddress}'
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
 * Dispatch actions to the GG.xyz API endpoint
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
      playerAddress,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to dispatch actions: ${response.statusText}`);
  }

  return await response.json();
}
