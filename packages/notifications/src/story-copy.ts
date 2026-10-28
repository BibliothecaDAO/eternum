/** What a story's alert says: its title, and its line under the game's name. */
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

/**
 * Goods sent to the player, told from the receiver's side (the only one alerted): landed when they took no road
 * (travel_time 0), else still on it.
 */
function transferCopy(payload: Record<string, unknown>): NotificationCopy {
  const travel = integer(payload.travel_time);
  if (travel === null) throw new Error("Incomplete resource transfer story");
  return travel === 0n
    ? { title: "Supplies received", body: "A shipment has reached your stores." }
    : { title: "Supplies on the road", body: "A shipment is on its way to your stores." };
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
