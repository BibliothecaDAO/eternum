import { nativeRuleConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { Schema } from "effect";
import type { HeldRealm } from "@realms-world/identity";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { shortString, type CairoOption } from "starknet";
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
  /** The held Realm the player names; null registers the campaign ticket identity holds for them, if any. */
  realmId: number | null;
  realmsId: string;
  account: string;
}
/** The source a Frontier home claims from: a held Realm, a campaign's ticket, or none (a free home). */
export type HomeSource = { realmId: number } | { campaign: string; tier: TicketTier } | Record<string, never>;
type TicketTier = "regular" | "golden";
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

/** The Realms the player's linked wallet holds, for the settle picker; none without a linked wallet. */
export const handleHeldRealmsRequest = (request: Request, route: PlayerIdentity & { identity: HoldingsIdentity }) =>
  playerRequest(request, route, async (player) => ({ realms: await readHeldRealms(route.identity, player.realmsId) }));

interface HoldingsIdentity {
  linkedWallet(id: string): Promise<string | null>;
  heldRealms(wallet: string): Promise<HeldRealm[]>;
}

async function readHeldRealms(identity: HoldingsIdentity, realmsId: string): Promise<HeldRealm[]> {
  const wallet = await identity.linkedWallet(realmsId);
  if (!wallet) return [];
  return identity.heldRealms(wallet).catch(() => {
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
    campaignTicket(realmsId: string, presetId: number): Promise<{ campaign: string; tier: TicketTier } | null>;
  };
}
type Entitlement = { realm_id: bigint; metadata_1: bigint; metadata_2: bigint; metadata_3: bigint; pass_kind: bigint };

/** The entitlement kinds and campaign tiers as the contract reads them (settlement.cairo). */
const HELD_REALM_KIND = 2;
const CAMPAIGN_KIND = 3;
const CAMPAIGN_TIERS: Record<TicketTier, number> = { regular: 1, golden: 2 };

/**
 * A Frontier home's source, registered before the player founds it, then immutable for the game: the held Realm the
 * player names (ownership proved here), else the campaign ticket identity holds for this game's preset, else none.
 * An exact retry answers the registered source without another write; a different source is refused.
 */
export async function registerHomeSource(target: RealmEntryTarget, claim: RealmEntryClaim): Promise<HomeSource> {
  const entry = await openEntry(target, claim);
  const previous = (await entry.read()).unwrap();
  const { realmId } = claim;
  if (realmId !== null)
    return previous ? matchingEntry(previous, realmId) : registerHeldRealm(target, { ...claim, realmId }, entry);
  if (previous) return sourceOf(previous);
  const presetId = Number(singleRow(entry.snapshot, "GameRegistry").preset_id);
  const ticket = await target.identity.campaignTicket(claim.realmsId, presetId);
  // A free home already founded gains no source later.
  if (!ticket || hasEntered(entry.snapshot, claim.account)) return {};
  return writeEntry(entry, claim, campaignEntitlement(ticket));
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
    "PlayerEntry",
  ]);
  await requireOpenFrontier(target.connection, snapshot);
  const operator = new ShardOperator({
    ...target.connection,
    accountAddress: target.operatorAddress,
    privateKey: target.privateKey,
  } satisfies ShardTarget);
  const read = () => operator.view<CairoOption<Entitlement>>("entry_entitlement", [claim.gameId, claim.account]);
  return { snapshot, operator, read };
}
type OpenEntry = Awaited<ReturnType<typeof openEntry>>;

async function registerHeldRealm(
  target: RealmEntryTarget,
  claim: RealmEntryClaim & { realmId: number },
  entry: OpenEntry,
) {
  await requireHeldWallet(target.identity, claim);
  if (hasEntered(entry.snapshot, claim.account)) throw new PlayerRequestError(409, "owner_already_settled");
  if ((await entry.operator.view<bigint>("settled_realm", [claim.gameId, claim.realmId])) !== 0n)
    throw new PlayerRequestError(409, "realm_already_settled");
  const held = { realm_id: claim.realmId, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: HELD_REALM_KIND };
  return writeEntry(entry, claim, held);
}

const campaignEntitlement = (ticket: { campaign: string; tier: TicketTier }) => ({
  realm_id: 0,
  metadata_1: shortString.encodeShortString(ticket.campaign),
  metadata_2: CAMPAIGN_TIERS[ticket.tier],
  metadata_3: 0,
  pass_kind: CAMPAIGN_KIND,
});

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
  const saved = (await entry.read()).unwrap();
  if (!saved) throw new Error("realm_entry_not_recorded");
  return sourceOf(saved);
}

const hasEntered = (snapshot: ConfirmedSnapshot, account: string) =>
  snapshot.models
    .find((model) => model.model === "PlayerEntry")!
    .rows.some(({ value }) => sameFelt(String(value.player), account));

async function requireOpenFrontier(connection: ShardConnection, snapshot: ConfirmedSnapshot) {
  const game = singleRow(snapshot, "GameRegistry");
  const rules = singleRow(snapshot, "SliceRules");
  const head = await new ShardReader(connection).header("latest");
  if (
    Number(rules.entry_rule) !== nativeRuleConstants.ENTRY_OPEN ||
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
  if (BigInt(entry.pass_kind) === BigInt(CAMPAIGN_KIND))
    return {
      campaign: shortString.decodeShortString(`0x${BigInt(entry.metadata_1).toString(16)}`),
      tier: BigInt(entry.metadata_2) === BigInt(CAMPAIGN_TIERS.golden) ? "golden" : "regular",
    };
  throw new PlayerRequestError(409, "conflicting_entry_entitlement");
}
