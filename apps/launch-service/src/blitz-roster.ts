import { Data, Effect } from "effect";
import { normalizeAddress } from "./address";

interface BlitzRosterKey {
  chainId: string;
  gameName: string;
}
interface BlitzRegistration {
  wallet: string;
  account: string;
}
interface FrozenBlitzRoster {
  gameId: number;
  blockNumber: number;
  blockHash: string;
  registrations: readonly BlitzRegistration[];
}
export interface BlitzRegistrationSource {
  /** Must read a closed ledger registration at a confirmed L2 block with its recorded shard accounts. */
  readClosed(key: BlitzRosterKey): Effect.Effect<FrozenBlitzRoster, RosterFailure | RegistrationOpen>;
}
export class RosterFailure extends Data.TaggedError("RosterFailure")<{ operation: string }> {}

export class RegistrationOpen extends Data.TaggedError("RegistrationOpen")<{ secondsUntilClose: number }> {}

export class D1BlitzRosterStore {
  constructor(private readonly db: D1Database) {}
  async read(key: BlitzRosterKey): Promise<FrozenBlitzRoster | null> {
    const row = await this.db
      .prepare("SELECT roster FROM blitz_ledger_rosters WHERE chain_id = ? AND game_name = ?")
      .bind(key.chainId, key.gameName)
      .first<{ roster: string }>();
    return row ? (JSON.parse(row.roster) as FrozenBlitzRoster) : null;
  }
  async save(key: BlitzRosterKey, roster: FrozenBlitzRoster): Promise<FrozenBlitzRoster> {
    await this.db
      .prepare("INSERT INTO blitz_ledger_rosters (chain_id, game_name, roster) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
      .bind(key.chainId, key.gameName, JSON.stringify(roster))
      .run();
    const frozen = await this.read(key);
    if (!frozen) throw new Error("Frozen roster was not persisted");
    return frozen;
  }
}

/** Every launch uses one ledger snapshot, persisted before seating and reused after retries. */
export const freezeBlitzRoster = (
  key: BlitzRosterKey,
  source: BlitzRegistrationSource,
  store: Pick<D1BlitzRosterStore, "read" | "save">,
) =>
  Effect.gen(function* () {
    const stored = yield* rosterOperation("read frozen roster", () => store.read(key));
    if (stored) return stored;
    const roster = yield* source.readClosed(key);
    if (!hasConfirmedLedgerHead(roster))
      return yield* Effect.fail(new RosterFailure({ operation: "invalid_ledger_head" }));
    const registrations = roster.registrations.map(({ wallet, account }) => ({
      wallet: normalizeAddress(wallet),
      account: normalizeAddress(account),
    }));
    if (!hasValidRoster(registrations))
      return yield* Effect.fail(new RosterFailure({ operation: "invalid_ledger_roster" }));
    return yield* rosterOperation("freeze ledger roster", () => store.save(key, { ...roster, registrations }));
  });
const rosterOperation = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: () => new RosterFailure({ operation }) });

const hasConfirmedLedgerHead = (roster: FrozenBlitzRoster) =>
  Number.isSafeInteger(roster.gameId) &&
  roster.gameId > 0 &&
  roster.gameId <= 0xffffffff &&
  Number.isSafeInteger(roster.blockNumber) &&
  roster.blockNumber >= 0 &&
  /^0x[0-9a-fA-F]+$/.test(roster.blockHash);
const hasValidRoster = (registrations: readonly BlitzRegistration[]) =>
  registrations.length > 0 &&
  registrations.length <= 24 &&
  registrations.every(({ wallet, account }) => BigInt(wallet) !== 0n && BigInt(account) !== 0n) &&
  new Set(registrations.map((r) => r.wallet)).size === registrations.length &&
  new Set(registrations.map((r) => r.account)).size === registrations.length;
