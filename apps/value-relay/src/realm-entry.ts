import { nativeIdentifiers, nativeReleaseConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { Schema } from "effect";
import type { HeldRealm, HeldRealmsAnswer } from "@realms-world/identity";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { ShardReader, sameFelt, type ShardConnection } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow, type ConfirmedSnapshot } from "./shard-snapshot";
import { playerRequest, readPlayerBody, PlayerRequestError, type PlayerIdentity } from "./player-request";

const RealmEntryRequest = Schema.Struct({
  gameId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 0xffffffff }))),
  realmId: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 8000 })))),
});
export interface RealmEntryClaim {
  chainId: string;
  gameId: number;
  realmId: number | null;
  realmsId: string;
  account: string;
  sealOnly?: true;
}
export type HomeSource = { realmId: number } | Record<string, never>;
interface RealmEntryRoute extends PlayerIdentity {
  chainId: string;
  register(claim: RealmEntryClaim): Promise<HomeSource>;
}
export const handleRealmEntryRequest = (request: Request, route: RealmEntryRoute) =>
  playerRequest(request, route, async (player) => {
    const body = await readPlayerBody(
      request,
      Schema.decodeUnknownSync(RealmEntryRequest, { onExcessProperty: "error" }),
      "invalid_realm_entry",
    );
    return route.register({ gameId: body.gameId, realmId: body.realmId ?? null, ...player, chainId: route.chainId });
  });

/**
 * The Realms the player's linked wallet holds, for the settle picker; none without a linked wallet. The answer carries
 * them in both shapes a running client reads (HeldRealmsAnswer): numbers, and each with its map.
 */
export const handleHeldRealmsRequest = (request: Request, route: PlayerIdentity & { identity: HoldingsIdentity }) =>
  playerRequest(request, route, async (player): Promise<HeldRealmsAnswer> => {
    const held = await readHeldRealms(route.identity, player.realmsId);
    return { realms: held.map((realm) => realm.realmId), held };
  });

interface HoldingsIdentity {
  linkedWallet(id: string): Promise<string | null>;
  heldRealmsWithMaps(wallet: string): Promise<HeldRealm[]>;
}

async function readHeldRealms(identity: HoldingsIdentity, realmsId: string): Promise<HeldRealm[]> {
  const wallet = await identity.linkedWallet(realmsId);
  if (!wallet) return [];
  return identity.heldRealmsWithMaps(wallet).catch(() => {
    throw new PlayerRequestError(503, "realm_holdings_unavailable");
  });
}

interface RealmEntryTarget {
  connection: ShardConnection;
  heraldUrl: string;
  operatorAddress: string;
  privateKey: string;
  identity: {
    accountForRealmsId(id: string): Promise<string | null>;
    linkedWallet(id: string): Promise<string | null>;
    holdsRealm(wallet: string, realmId: number): Promise<boolean>;
    holdsSeal(realmsId: string): Promise<boolean>;
  };
}
type Entitlement = { realm_id: bigint; metadata_1: bigint; metadata_2: bigint; metadata_3: bigint; pass_kind: bigint };

const HELD_REALM_KIND = 2;

export async function registerHomeSource(target: RealmEntryTarget, claim: RealmEntryClaim): Promise<HomeSource> {
  const entry = await openEntry(target, claim);
  await grantHeldSeal(target, claim, entry);
  if (claim.sealOnly) return {};
  const previous = readEntitlement(entry.snapshot, claim.account);
  const { realmId } = claim;
  if (realmId !== null)
    return previous ? matchingEntry(previous, realmId) : registerHeldRealm(target, { ...claim, realmId }, entry);
  return previous ? sourceOf(previous) : {};
}

/** The game open for settling, the account the session's, and the operator that reads and writes its entitlement. */
async function openEntry(target: RealmEntryTarget, claim: RealmEntryClaim) {
  if (!sameFelt(target.connection.chainId, claim.chainId)) throw new PlayerRequestError(409, "shard_chain_differs");
  const account = await target.identity.accountForRealmsId(claim.realmsId);
  if (!account || !sameFelt(account, claim.account)) throw new PlayerRequestError(403, "account_unavailable");
  const snapshot = await readConfirmedSnapshot(target.connection, target.heraldUrl, claim.gameId, [
    "GameRegistry",
    "SliceRules",
    "GameRelease",
    "EntryEntitlement",
    "SettledRealm",
    "Seal",
  ]);
  await requireOpenFrontier(target.connection, snapshot);
  const operator = new ShardOperator({
    ...target.connection,
    accountAddress: target.operatorAddress,
    privateKey: target.privateKey,
  } satisfies ShardTarget);
  return { snapshot, operator };
}
type OpenEntry = Awaited<ReturnType<typeof openEntry>>;

async function grantHeldSeal(target: RealmEntryTarget, claim: RealmEntryClaim, entry: OpenEntry) {
  if (Number(singleRow(entry.snapshot, "GameRelease").release_id) < nativeReleaseConstants.SEAL_RELEASE) return;
  const granted = entry.snapshot.models
    .find((model) => model.model === "Seal")!
    .rows.some(({ value }) => sameFelt(String(value.account), claim.account));
  if (granted) return;
  const held = await target.identity.holdsSeal(claim.realmsId).catch(() => {
    throw new PlayerRequestError(503, "seal_check_unavailable");
  });
  if (!held) return;
  try {
    await entry.operator.admin("grant_seal", { game_id: claim.gameId, account: claim.account });
  } catch {
    throw new PlayerRequestError(503, "seal_grant_unavailable");
  }
}

async function registerHeldRealm(
  target: RealmEntryTarget,
  claim: RealmEntryClaim & { realmId: number },
  entry: OpenEntry,
) {
  await requireHeldWallet(target.identity, claim);
  if (
    entry.snapshot.models
      .find((model) => model.model === "SettledRealm")!
      .rows.some(({ value }) => Number(value.realm_id) === claim.realmId)
  )
    throw new PlayerRequestError(409, "realm_already_settled");
  const held = { realm_id: claim.realmId, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: HELD_REALM_KIND };
  return writeEntry(entry, claim, held);
}

async function writeEntry(
  entry: OpenEntry,
  claim: RealmEntryClaim,
  entitlement: Record<keyof Entitlement, number | string>,
): Promise<HomeSource> {
  try {
    await entry.operator.admin("register_entitlement", {
      key: { game_id: claim.gameId, owner: claim.account },
      entitlement,
    });
  } catch {
    throw new PlayerRequestError(409, "realm_registration_refused");
  }
  return sourceOf({
    realm_id: BigInt(entitlement.realm_id),
    metadata_1: BigInt(entitlement.metadata_1),
    metadata_2: BigInt(entitlement.metadata_2),
    metadata_3: BigInt(entitlement.metadata_3),
    pass_kind: BigInt(entitlement.pass_kind),
  });
}

function readEntitlement(snapshot: ConfirmedSnapshot, account: string): Entitlement | undefined {
  const row = snapshot.models
    .find((model) => model.model === "EntryEntitlement")!
    .rows.find(({ value }) => sameFelt(String(value.owner), account))?.value;
  return row
    ? {
        realm_id: BigInt(String(row.realm_id)),
        metadata_1: BigInt(String(row.metadata_1)),
        metadata_2: BigInt(String(row.metadata_2)),
        metadata_3: BigInt(String(row.metadata_3)),
        pass_kind: BigInt(String(row.pass_kind)),
      }
    : undefined;
}

async function requireOpenFrontier(connection: ShardConnection, snapshot: ConfirmedSnapshot) {
  const game = singleRow(snapshot, "GameRegistry");
  const rules = singleRow(snapshot, "SliceRules");
  const head = await new ShardReader(connection).header("latest");
  if (
    Number(rules.entry_rule) !== nativeIdentifiers.rule.ENTRY_OPEN ||
    Number(rules.day_unit_seconds) === 0 ||
    Number(singleRow(snapshot, "GameRelease").release_id) < 3
  )
    throw new PlayerRequestError(409, "held_realm_requires_frontier");
  if (
    game.settled ||
    head.timestamp < Number(game.start_settling_at) ||
    (Number(game.end_at) !== 0 && head.timestamp >= Number(game.end_at))
  )
    throw new PlayerRequestError(409, "settlement_closed");
}

/** The linked wallet holds the Realm; an unanswerable check asks the player to retry rather than refusing them. */
async function requireHeldWallet(identity: RealmEntryTarget["identity"], claim: RealmEntryClaim & { realmId: number }) {
  const wallet = await identity.linkedWallet(claim.realmsId);
  if (!wallet) throw new PlayerRequestError(409, "realm_wallet_missing");
  const held = await identity.holdsRealm(wallet, claim.realmId).catch(() => {
    throw new PlayerRequestError(503, "realm_check_unavailable");
  });
  if (!held) throw new PlayerRequestError(409, "realm_not_owned");
}

function matchingEntry(entry: Entitlement, realmId: number): HomeSource {
  if (
    BigInt(entry.realm_id) !== BigInt(realmId) ||
    BigInt(entry.pass_kind) !== BigInt(HELD_REALM_KIND) ||
    entry.metadata_1 !== 0n ||
    entry.metadata_2 !== 0n ||
    entry.metadata_3 !== 0n
  )
    throw new PlayerRequestError(409, "conflicting_entry_entitlement");
  return { realmId };
}

/** The source a registered entitlement names. */
function sourceOf(entry: Entitlement): HomeSource {
  if (BigInt(entry.pass_kind) === BigInt(HELD_REALM_KIND)) return { realmId: Number(entry.realm_id) };
  throw new PlayerRequestError(409, "conflicting_entry_entitlement");
}
