/** What a story's alert says: its title, and its line under the game's name. */
export interface NotificationCopy {
  title: string;
  body: string;
}

/** What a story's copy reads: its payload, the story's own value, and the account the alert is for. */
interface CopyInput {
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
  const amount = integer(payload.amount);
  if (amount === null) throw new Error("Incomplete reward chest story");
  return amount === 0n
    ? { title: "The chest was empty", body: "Its reservation ran out before it was opened: no LORDS were paid." }
    : { title: "A chest is open", body: `${groupThousands(amount.toString())} LORDS have reached your realm.` };
};

export const bankSwapCopy: StoryCopy = ({ payload }) =>
  payload.buy === true
    ? { title: "Bought at the bank", body: "Your goods are on their way to your realm." }
    : { title: "Sold at the bank", body: "Your LORDS are on their way to your realm." };

/**
 * A withdrawal goes where its story says: to the player's wallet when it names no structure (structure_id 0), else on
 * the bank's donkeys to that structure, still on the road when the story is told.
 */
export const bankLiquidityCopy: StoryCopy = ({ payload }) => {
  if (payload.add === true) return { title: "Liquidity added", body: "Your goods now stand in the bank's market." };
  const toWallet = compareInteger(payload.structure_id, 0);
  if (toWallet === null) throw new Error("Incomplete bank liquidity story");
  return toWallet
    ? { title: "Liquidity withdrawn", body: "Your share of the market was sent to your wallet." }
    : { title: "Liquidity withdrawn", body: "Your share of the market is on its way to your stores." };
};

/** Story points are at the contract's precision (a millionth of a point); a player reads whole points. */
const POINTS_PRECISION = 1_000_000n;

export const hyperstructurePointsCopy: StoryCopy = ({ payload }) => {
  const points = integer(payload.points);
  if (points === null) throw new Error("Incomplete hyperstructure points story");
  const whole = points / POINTS_PRECISION;
  return {
    title: "Hyperstructure points earned",
    body:
      whole === 0n
        ? "Your share brought less than a point."
        : `Your share brought ${groupThousands(whole.toString())} ${whole === 1n ? "point" : "points"}.`,
  };
};

/** The mine pays a phase's winner into the realm they contributed from; nothing when that realm is no longer theirs. */
export const bitcoinAwardCopy: StoryCopy = ({ payload }) => {
  const paid = integer(payload.winner_paid);
  if (paid === null) throw new Error("Incomplete Bitcoin award story");
  return paid > 0n
    ? { title: "The Bitcoin mine paid out", body: "Your share has reached your realm." }
    : { title: "Your Bitcoin share was not paid", body: "Nothing reached your realm this phase." };
};

/** An attribute's tiers, by the names the army's Level up panel gives them (tier 1 is Common). */
const TIER_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;

/** A Level up raises one attribute of one army a tier, for XP; the troops' own T1–T3 tier never changes. */
export const tierBoughtCopy: StoryCopy = ({ payload }) => {
  const attribute = enumName(payload.attribute);
  const tier = integer(payload.tier);
  const price = integer(payload.price);
  const name = tier === null ? undefined : TIER_NAMES[Number(tier) - 1];
  if (!attribute || !name || price === null) throw new Error("Incomplete tier purchase story");
  return { title: `Level up: ${attribute}`, body: `Your army's ${attribute} is now ${name}, for ${price} XP.` };
};

/**
 * A find is granted the moment it is revealed: to the army's home where the game sends finds home, else to the army
 * that found it (receiver is then the army itself).
 */
const findCopy =
  (title: string, found: string, home: string, carried: string): StoryCopy =>
  ({ payload }) => {
    const byArmy = compareInteger(payload.receiver, payload.explorer_id);
    if (byArmy === null) throw new Error("Incomplete find story");
    return { title, body: `${found}; ${byArmy ? carried : home}.` };
  };
export const explorationRewardCopy = findCopy(
  "A find on the trail",
  "Your army turned up resources",
  "they reached your realm",
  "your army carries them",
);
export const spireDiscoveredCopy = findCopy(
  "A dormant spire is found",
  "Your army found a spire",
  "its Essence reached your realm",
  "your army carries its Essence",
);

/** A cleared site pays its home at once: a resource, nothing when a ruin's chest held none, or only the clear's XP. */
export const sitePayoutCopy: StoryCopy = ({ payload }) => {
  if (payload.reward === undefined) throw new Error("Incomplete site payout story");
  if (payload.reward === null)
    return { title: "A site is cleared", body: "Your army earned its XP; nothing more was held." };
  const amount = integer(record(payload.reward).amount);
  if (amount === null) throw new Error("Incomplete site payout story");
  return amount === 0n
    ? { title: "A site is cleared", body: "Your army earned its XP; the site held nothing to pay." }
    : { title: "A site is cleared", body: "Your army earned its XP, and its reward reached your realm." };
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

/**
 * A transfer is told when it is sent: it has landed only when it took no road (travel_time 0). The story's entity tells
 * the receiving side from the sending one; without it, the shipment alone is told.
 */
function transferCopy(payload: Record<string, unknown>, value: Record<string, unknown>): NotificationCopy {
  const travel = integer(payload.travel_time);
  if (travel === null) throw new Error("Incomplete resource transfer story");
  const landed = travel === 0n;
  const received = compareInteger(payload.to_entity_id, value.entity_id);
  if (received === true)
    return landed
      ? { title: "Supplies received", body: "A shipment has reached your stores." }
      : { title: "Supplies on the road", body: "A shipment is on its way to your stores." };
  if (received === false)
    return landed
      ? { title: "Supplies delivered", body: "Your shipment has reached its destination." }
      : { title: "Supplies dispatched", body: "Your shipment is on its way." };
  return landed
    ? { title: "Supplies are moving", body: "A shipment has reached its destination." }
    : { title: "Supplies are moving", body: "A shipment is on its way." };
}

/** A structure's levels, by the ranks the game names them (level 0 is a Settlement). */
const RANK_NAMES = ["Settlement", "City", "Kingdom", "Empire"] as const;

function structureLevelCopy(payload: Record<string, unknown>): NotificationCopy {
  const level = integer(payload.new_level);
  const rank = level === null ? undefined : RANK_NAMES[Number(level)];
  if (!rank) throw new Error("Incomplete level up story");
  return { title: "Your realm grows stronger", body: `It is now ${rank === "Empire" ? "an" : "a"} ${rank}.` };
}

/** A whole number from the story, whatever spelling it arrived in; null when it is not one. */
function integer(value: unknown): bigint | null {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
}

/** A Cairo enum's variant name, as the story carries it ("Battle" or { Battle: {} }). */
function enumName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const entries = Object.keys(record(value));
  return entries.length === 1 ? entries[0] : undefined;
}

function compareInteger(left: unknown, right: unknown): boolean | null {
  const [a, b] = [integer(left), integer(right)];
  return a === null || b === null ? null : a === b;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
