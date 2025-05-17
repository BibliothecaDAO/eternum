import { env } from "process";
import { shortString } from "starknet";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const API_BASE_URL = env.PUBLIC_TORII + "/sql";

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
  const felt = shortString.encodeShortString(achievement);
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

const API_URL = env.PUBLIC_ACTION_DISPATCHER_URL || "";
const API_SECRET = env.PUBLIC_ACTION_DISPATCHER_SECRET || "";

/**
 * Dispatch actions to the GG.xyz API endpoint through our secure backend
 * @param actions Array of action strings to dispatch
 * @param playerAddress The player's address
 * @returns Promise with the API response
 */
export async function dispatchActions(actions: string[], playerAddress: string): Promise<ActionDispatcherResponse> {
  console.log(
    `${colors.blue}${colors.bright}📤 Dispatching actions:${colors.reset} ${colors.dim}${actions.join(", ")}${colors.reset} ${colors.blue}${colors.bright}to player:${colors.reset} ${colors.dim}${playerAddress}${colors.reset}`,
  );
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
    console.error(
      `${colors.red}${colors.bright}❌ Failed to dispatch actions:${colors.reset} ${colors.dim}${response.statusText}${colors.reset}`,
    );
  } else {
    console.log(
      `${colors.green}${colors.bright}✅ Actions dispatched:${colors.reset} ${colors.dim}${actions.join(", ")}${colors.reset}`,
    );
  }

  return await response.json();
}

// takes timestamp in seconds
export async function dispatchGgXyzQuestProgress(afterTimestamp: number): Promise<number> {
  const progressions = await fetchAllTrophyEventsAfterTimestamp(afterTimestamp);
  console.log(
    `${colors.cyan}${colors.bright}📊 Fetched ${progressions.length} trophy events since ${colors.reset}${colors.dim}${new Date(afterTimestamp * 1000).toISOString()}${colors.reset}`,
  );

  if (progressions.length === 0) {
    return afterTimestamp;
  }

  // Find the latest timestamp in this batch
  const latestTimestamp = Math.max(...progressions.map((p) => p.time));

  // process each progression
  for (const progression of progressions) {
    const { player_id, task_id, total_count } = progression;

    // check if the achievement is completed
    const achievement = Object.keys(QUEST_THRESHOLDS).find((key) => getTaskId(key as Achievements) === task_id);
    if (achievement) {
      const thresholds = QUEST_THRESHOLDS[achievement as Achievements];
      for (const threshold of thresholds) {
        if (total_count >= threshold.threshold) {
          const normalizedPlayerId = normalizePlayerAddress(player_id);

          // Dispatch action if API is configured
          if (API_URL !== "" && API_SECRET !== "") {
            try {
              await dispatchActions([threshold.action], normalizedPlayerId);
            } catch (error) {
              console.error(`${colors.red}${colors.bright}❌ Failed to dispatch actions:${colors.reset}`, error);
              // Don't throw here, continue processing other events
            }
          }
        }
      }
    }
  }

  console.log(
    `${colors.green}${colors.bright}✅ Successfully processed events up to ${colors.reset}${colors.dim}${new Date(latestTimestamp * 1000).toISOString()}${colors.reset}`,
  );
  return latestTimestamp;
}

/**
 * Fetches all trophy progression events for all players after a specific timestamp
 * @param afterTimestamp The timestamp to fetch events after (in seconds)
 * @returns Promise with an array of trophy progression events
 */
export async function fetchAllTrophyEventsAfterTimestamp(afterTimestamp: number): Promise<
  Array<{
    player_id: string;
    task_id: string;
    time: number;
    total_count: number;
  }>
> {
  // Convert Unix timestamp to ISO string
  const isoDate = new Date(afterTimestamp * 1000).toISOString();

  const query = `
    SELECT
      player_id,
      task_id,
      time,
      SUM(count) as total_count
    FROM
      "s1_eternum-TrophyProgression"
    WHERE
      internal_executed_at > '${isoDate}'
    GROUP BY
      player_id,
      task_id,
      time
    ORDER BY
      time ASC
  `;

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${colors.red}${colors.bright}❌ Failed to fetch trophy events:${colors.reset} ${colors.dim}${response.statusText}${colors.reset}`,
        errorText,
      );
      throw new Error(`Failed to fetch trophy events: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`${colors.red}${colors.bright}❌ Error fetching trophy events:${colors.reset}`, error);
    throw error;
  }
}
