import { logicalStoryIdentity, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";

/** Shared display content and logical identity for live-page and server delivery. */
export function buildStoryNotification(input: {
  sourceId: string;
  value: Record<string, unknown>;
  owner: string;
  gameName: string;
  target: string;
  now: number;
}): LocalNotificationPayload | null {
  const { story, payload } = readNotificationStory(input.value);
  const createdAt = storyNotificationCreatedAt(input.value);
  if (createdAt + 120_000 <= input.now) return null;
  const copy = storyNotificationCopy(story, payload, input.value);
  return parseNotificationPayload(
    {
      version: 1,
      owner: input.owner,
      id: logicalStoryIdentity(input.sourceId, story, input.value, payload),
      title: copy.title,
      body: `${input.gameName}: ${copy.body}`,
      target: input.target,
      createdAt,
      expiresAt: createdAt + 120_000,
    },
    input.now,
  );
}

interface NotificationCopy {
  title: string;
  body: string;
}

/** One voice for live-page and background game alerts. Unknown variants remain loud in development. */
export function storyNotificationCopy(
  story: string,
  payload: Record<string, unknown>,
  value: Record<string, unknown>,
): NotificationCopy {
  switch (story) {
    case "BattleStory":
      return battleCopy(payload, value);
    case "RealmCreatedStory":
      return { title: "A new realm rises", body: "Your banner now flies over fresh lands." };
    case "BuildingPlacementStory":
      return buildingCopy(payload);
    case "StructureLevelUpStory":
      return structureLevelCopy(payload);
    case "ExplorerExtractRewardStory":
      return { title: "Your scouts struck treasure", body: "A hard-won reward is ready for the realm." };
    case "ResourceReceiveArrivalStory":
      return { title: "The caravan has arrived", body: "Fresh supplies have reached their destination." };
    case "ProductionStory":
      return { title: "The workshops are humming", body: "A new batch of resources is ready." };
    case "BuildingPaymentStory":
      return { title: "Construction is underway", body: "The builders have their materials and their orders." };
    case "ResourceTransferStory":
      return transferCopy(payload, value);
    case "ResourceBurnStory":
      return { title: "Resources committed", body: "The realm has paid its due." };
    case "ExplorerMoveStory":
      return payload.explore === true
        ? { title: "Into the unknown", body: "Your army marches beyond the known map." }
        : { title: "Your army is on the march", body: "Orders are set and banners are moving." };
    case "ExplorerCreateStory":
      return { title: "An army answers the call", body: "New troops stand ready beyond the walls." };
    case "ExplorerAddStory":
      return { title: "Reinforcements have arrived", body: "Fresh troops have joined your army." };
    case "ExplorerDeleteStory":
      return { title: "The banners return home", body: "An army has stood down." };
    case "GuardAddStory":
      return { title: "The walls are reinforced", body: "Fresh defenders have taken their posts." };
    case "GuardDeleteStory":
      return { title: "A guard post is clear", body: "Those troops are ready for new orders." };
    case "ExplorerExplorerSwapStory":
    case "ExplorerGuardSwapStory":
    case "GuardExplorerSwapStory":
      return { title: "Troops redeployed", body: "Your ranks have shifted into position." };
    default:
      if (process.env.NODE_ENV !== "production") throw new Error(`Unknown notification copy: ${story}`);
      return { title: "The realm is stirring", body: "New confirmed activity awaits your attention." };
  }
}

function battleCopy(payload: Record<string, unknown>, value: Record<string, unknown>): NotificationCopy {
  const victory = battleVictory(payload, value);
  const structureTaken =
    record(payload.attacker_structure).structure_taken === true ||
    record(payload.defender_structure).structure_taken === true;
  if (victory === true && structureTaken)
    return { title: "Victory — the stronghold is yours", body: "Your forces broke the defence and claimed the field." };
  if (victory === true) return { title: "Victory on the field", body: "Your forces carried the day." };
  if (victory === false && structureTaken)
    return { title: "A stronghold has fallen", body: "The enemy broke through. Rally the realm." };
  if (victory === false)
    return { title: "Your forces were defeated", body: "The battle is over. Your next move awaits." };
  return { title: "Battle lines have shifted", body: "The clash is over. Survey the field." };
}

function battleVictory(payload: Record<string, unknown>, value: Record<string, unknown>): boolean | null {
  if (compareInteger(payload.winner_id, 0) !== false) return null;
  const attacker = compareInteger(value.entity_id, payload.attacker_id);
  const defender = compareInteger(value.entity_id, payload.defender_id);
  if (attacker === true) return compareInteger(payload.winner_id, payload.attacker_owner_id);
  if (defender === true) return compareInteger(payload.winner_id, payload.defender_owner_id);
  return null;
}

function buildingCopy(payload: Record<string, unknown>): NotificationCopy {
  if (payload.destroyed === true)
    return { title: "A building has fallen", body: "The site is clear for what comes next." };
  if (payload.paused === true) return { title: "Construction paused", body: "The builders are awaiting fresh orders." };
  if (payload.unpaused === true) return { title: "The hammers ring again", body: "Construction has resumed." };
  return { title: "A new building takes shape", body: "Another piece of your realm is rising." };
}

function transferCopy(payload: Record<string, unknown>, value: Record<string, unknown>): NotificationCopy {
  const received = compareInteger(payload.to_entity_id, value.entity_id);
  if (received === true) return { title: "Supplies received", body: "A shipment has reached your stores." };
  if (received === false) return { title: "Supplies dispatched", body: "Your shipment is on its way." };
  return { title: "Supplies are moving", body: "A shipment has completed its journey." };
}

function structureLevelCopy(payload: Record<string, unknown>): NotificationCopy {
  const level = displayInteger(payload.new_level);
  return {
    title: "Your realm grows stronger",
    body: level ? `The keep has reached level ${level}.` : "The keep has reached a new height.",
  };
}

function displayInteger(value: unknown): string | null {
  try {
    return BigInt(value as string | number | bigint).toString();
  } catch {
    return null;
  }
}

function compareInteger(left: unknown, right: unknown): boolean | null {
  try {
    return BigInt(left as string | number | bigint) === BigInt(right as string | number | bigint);
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
export function readNotificationStory(value: Record<string, unknown>): {
  story: string;
  payload: Record<string, unknown>;
} {
  if (!value.story || typeof value.story !== "object" || Array.isArray(value.story))
    throw new Error("Invalid notification story");
  const entries = Object.entries(value.story);
  if (entries.length !== 1) throw new Error("Invalid notification story variant");
  const [story, payload] = entries[0];
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid notification story payload");
  return { story, payload: payload as Record<string, unknown> };
}

export function storyNotificationCreatedAt(value: Record<string, unknown>): number {
  const timestamp = value.timestamp;
  if (
    !(
      typeof timestamp === "number" ||
      typeof timestamp === "bigint" ||
      (typeof timestamp === "string" && /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(timestamp))
    )
  )
    throw new Error("Invalid story timestamp");
  const createdAt = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error("Invalid story timestamp");
  return createdAt;
}
