/** What a story's alert says: its title, and its line after the game's name ("Devcon: their stamina is full."). */
export interface NotificationCopy {
  title: string;
  body: string;
}

/** What a story's copy reads: its payload, and the account the alert is for. */
interface CopyInput {
  payload: Record<string, unknown>;
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
export const transferStoryCopy: StoryCopy = ({ payload }) => transferCopy(payload);

/** Story points are at the contract's precision (a millionth of a point); a player reads whole points. */
const POINTS_PRECISION = 1_000_000n;

export const hyperstructurePointsCopy: StoryCopy = ({ payload }) => {
  const points = integer(payload.points);
  if (points === null) throw new Error("Incomplete hyperstructure points story");
  const whole = points / POINTS_PRECISION;
  return {
    title: "You earned Hyperstructure points",
    body:
      whole === 0n
        ? "your share is less than a point."
        : `your share is ${groupThousands(whole.toString())} ${whole === 1n ? "point" : "points"}.`,
  };
};

/** The mine pays a phase's winner into the realm they contributed from; nothing when that realm is no longer theirs. */
export const bitcoinAwardCopy: StoryCopy = ({ payload }) => {
  const paid = integer(payload.winner_paid);
  if (paid === null) throw new Error("Incomplete Bitcoin award story");
  return paid > 0n
    ? { title: "The Bitcoin mine paid you", body: "your share is in your realm." }
    : { title: "Your Bitcoin share was not paid", body: "the realm you contributed from is no longer yours." };
};

/** A native battle names each side's player; the recipient's side tells victory from defeat. */
function nativeBattleCopy(payload: Record<string, unknown>, recipient: string | undefined): NotificationCopy {
  const attacker = compareInteger(record(payload.attacker).player, recipient) === true;
  const side = attacker ? payload.attacker_id : payload.defender_id;
  if (compareInteger(payload.winner_id, 0) !== false) return { title: "A battle ended", body: "neither side won." };
  return compareInteger(payload.winner_id, side) === true
    ? { title: "You won a battle", body: "your army beat the enemy." }
    : { title: "You lost a battle", body: "the enemy beat your army." };
}

/** A capture tells both sides what changed hands: a player's structure takes its armies and incoming deliveries along. */
function captureCopy(payload: Record<string, unknown>, recipient: string | undefined): NotificationCopy {
  if (compareInteger(payload.new_owner, recipient) !== true)
    return { title: "You lost a structure", body: "the enemy took it with its armies and incoming deliveries." };
  return compareInteger(payload.previous_owner, 0) === false
    ? { title: "You took a structure", body: "its armies and incoming deliveries are yours too." }
    : { title: "You took a structure", body: "it is yours now." };
}

function raidCopy(payload: Record<string, unknown>, recipient: string | undefined): NotificationCopy {
  const target = compareInteger(payload.target_owner, recipient) === true;
  if (target)
    return payload.success === true
      ? { title: "Your realm was raided", body: "raiders took some of your resources." }
      : { title: "You held off a raid", body: "your defenders kept your resources." };
  return payload.success === true
    ? { title: "Your raid succeeded", body: "your army is bringing the loot home." }
    : { title: "Your raid failed", body: "the defenders held and your army is falling back." };
}

/**
 * Goods sent to the player, told from the receiver's side (the only one alerted): landed when they took no road
 * (travel_time 0), else still on it.
 */
function transferCopy(payload: Record<string, unknown>): NotificationCopy {
  const travel = integer(payload.travel_time);
  if (travel === null) throw new Error("Incomplete resource transfer story");
  return travel === 0n
    ? { title: "Resources received", body: "they are in your stores." }
    : { title: "Resources on the way", body: "a shipment is heading to your stores." };
}

/** A whole number from the story, whatever spelling it arrived in; null when it is not one. */
function integer(value: unknown): bigint | null {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
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
