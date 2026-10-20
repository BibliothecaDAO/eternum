/** What a story's alert says: its title, and its line under the game's name. */
export interface NotificationCopy {
  title: string;
  body: string;
}

/** What a story's copy reads: its payload, the story's own value, and the account the alert is for. */
export interface CopyInput {
  payload: Record<string, unknown>;
  value: Record<string, unknown>;
  /** The account the alert is for, which native battles, raids and captures need to tell one side from the other. */
  recipient?: string;
}

export type StoryCopy = (input: CopyInput) => NotificationCopy;

/** The same words whatever the story carries. */
export const says =
  (title: string, body: string): StoryCopy =>
  () => ({ title, body });

export const battleCopy: StoryCopy = ({ payload, recipient }) => nativeBattleCopy(payload, recipient);
export const raidStoryCopy: StoryCopy = ({ payload, recipient }) => raidCopy(payload, recipient);
export const captureStoryCopy: StoryCopy = ({ payload, recipient }) => captureCopy(payload, recipient);
export const buildingStoryCopy: StoryCopy = ({ payload }) => buildingCopy(payload);
export const levelUpCopy: StoryCopy = ({ payload }) => structureLevelCopy(payload);
export const transferStoryCopy: StoryCopy = ({ payload, value }) => transferCopy(payload, value);

/** An exploration chest pays whole LORDS, the amount the contract records; none when its reservation ran out. */
export const rewardChestCopy: StoryCopy = ({ payload }) => {
  const amount = displayInteger(payload.amount);
  if (amount === null) throw new Error("Incomplete reward chest story");
  return amount === "0"
    ? { title: "The chest was empty", body: "Its reservation ran out before it was opened: no LORDS were paid." }
    : { title: "A chest is open", body: `${groupThousands(amount)} LORDS have reached your realm.` };
};

export const bankSwapCopy: StoryCopy = ({ payload }) =>
  payload.buy === true
    ? { title: "Bought at the bank", body: "Your goods are on their way to your realm." }
    : { title: "Sold at the bank", body: "Your LORDS are on their way to your realm." };

export const bankLiquidityCopy: StoryCopy = ({ payload }) =>
  payload.add === true
    ? { title: "Liquidity added", body: "Your goods now stand in the bank's market." }
    : { title: "Liquidity withdrawn", body: "Your share of the market is back in your stores." };

export const hyperstructurePointsCopy: StoryCopy = ({ payload }) => {
  const points = displayInteger(payload.points);
  return {
    title: "Hyperstructure points earned",
    body: points ? `Your share brought ${groupThousands(points)} points.` : "Your share brought new points.",
  };
};

/** A native battle names each side's player; the recipient's side tells victory from defeat. */
function nativeBattleCopy(payload: Record<string, unknown>, recipient: string | undefined): NotificationCopy {
  const attacker = compareInteger(record(payload.attacker).player, recipient) === true;
  const side = attacker ? payload.attacker_id : payload.defender_id;
  if (compareInteger(payload.winner_id, 0) !== false)
    return { title: "Battle lines have shifted", body: "The clash is over. Survey the field." };
  return compareInteger(payload.winner_id, side) === true
    ? { title: "Victory on the field", body: "Your forces carried the day." }
    : { title: "Your forces were defeated", body: "The battle is over. Your next move awaits." };
}

/** A capture tells both sides what changed hands: a player's structure takes its armies and incoming deliveries along. */
function captureCopy(payload: Record<string, unknown>, recipient: string | undefined): NotificationCopy {
  if (compareInteger(payload.new_owner, recipient) !== true)
    return { title: "A stronghold has fallen", body: "The enemy took it, with its armies and incoming deliveries." };
  return compareInteger(payload.previous_owner, 0) === false
    ? { title: "The stronghold is yours", body: "Its armies and incoming deliveries are yours too." }
    : { title: "The stronghold is yours", body: "Your banner now flies over the captured site." };
}

function raidCopy(payload: Record<string, unknown>, recipient: string | undefined): NotificationCopy {
  const target = compareInteger(payload.target_owner, recipient) === true;
  if (target)
    return payload.success === true
      ? { title: "Your realm was raided", body: "Raiders made off with supplies." }
      : { title: "A raid was repelled", body: "Your defenders held the walls." };
  return payload.success === true
    ? { title: "The raid succeeded", body: "Your army returns with its spoils." }
    : { title: "The raid failed", body: "The defenders held. Your army falls back." };
}

function buildingCopy(payload: Record<string, unknown>): NotificationCopy {
  switch (payload.change) {
    case "Created":
      return { title: "A new building takes shape", body: "Another piece of your realm is rising." };
    case "Destroyed":
      return { title: "A building has fallen", body: "The site is clear for what comes next." };
    case "Paused":
      return { title: "Construction paused", body: "The builders are awaiting fresh orders." };
    case "Resumed":
      return { title: "The hammers ring again", body: "Construction has resumed." };
    default:
      throw new Error("Incomplete building placement story");
  }
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

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
