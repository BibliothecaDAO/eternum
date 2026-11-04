/**
 * Who gets the Devcon Season 0 comeback email, and the send itself: the parts of scripts/comeback-email.ts that decide
 * and that must be safe to run twice, kept apart from its reads and its Resend calls so they can be tested.
 */

export type VariantKey = "D" | "N" | "P";

export interface Account {
  realmsId: string;
  discord: boolean;
  ticket: "regular" | "golden" | null;
  playtester: boolean;
  inSeason: boolean;
  /** The account's latest Season 0 action, in seconds; 0 for none. */
  lastAction: number;
  /** The account followed a news email's stop link. */
  optedOut: boolean;
}

/**
 * Each account in at most one variant, D before N before P; none for an account that stopped news emails:
 * - D: holds a Devcon ticket, founded in Season 0, no action yet today (UTC).
 * - N: holds a Devcon ticket, never founded.
 * - P: owns an address on the playtest's final board, holds no ticket, no Season 0 action yet today (UTC).
 */
export function variantOf(account: Account, todayStart: number): VariantKey | null {
  if (account.optedOut) return null;
  if (account.ticket && account.inSeason) return account.lastAction < todayStart ? "D" : null;
  if (account.ticket) return "N";
  if (account.playtester && account.lastAction < todayStart) return "P";
  return null;
}

export interface Delivery {
  realmsId: string;
  variant: VariantKey;
}

export interface CampaignSend<T extends Delivery> {
  campaign: string;
  deliveries: readonly T[];
  /** The accounts this campaign already reached, as its send record holds them. */
  alreadySent: ReadonlySet<string>;
  /** Hands one email to the provider under the key; a retry under the same key is delivered once. */
  send: (delivery: T, idempotencyKey: string) => Promise<{ ok: boolean; id: string | null }>;
  /** Writes the account into the campaign's send record. */
  record: (delivery: T, id: string | null) => Promise<void>;
  /** Waits between emails, so sign-in codes keep the provider's rate. */
  pause: () => Promise<void>;
}

/**
 * Sends each delivery the campaign has not reached yet, records it once the provider accepts it, and stops at the first
 * refusal. A crash between the provider's acceptance and the record is safe: the rerun sends under the same key, which
 * the provider delivers once.
 */
export async function sendCampaign<T extends Delivery>(run: CampaignSend<T>) {
  const counts = { sent: 0, skipped: 0, refused: 0 };
  for (const delivery of run.deliveries) {
    if (run.alreadySent.has(delivery.realmsId)) {
      counts.skipped++;
      continue;
    }
    const result = await run.send(delivery, `${run.campaign}:${delivery.realmsId}`);
    if (!result.ok) {
      counts.refused++;
      break;
    }
    await run.record(delivery, result.id);
    counts.sent++;
    await run.pause();
  }
  return counts;
}
