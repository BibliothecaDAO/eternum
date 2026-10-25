import { nativeRuleConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { Schema } from "effect";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import type { CairoOption } from "starknet";
import { ShardReader, sameFelt, type ShardConnection } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow, type ConfirmedSnapshot } from "./shard-snapshot";
import { playerRequest, readPlayerBody, PlayerRequestError, type PlayerIdentity } from "./player-request";

const RealmEntryRequest = Schema.Struct({
  gameId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 0xffffffff }))),
  realmId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 8000 }))),
});
export interface RealmEntryClaim {
  chainId: string;
  gameId: number;
  realmId: number;
  realmsId: string;
  account: string;
}
interface RealmEntryRoute extends PlayerIdentity {
  chainId: string;
  register(claim: RealmEntryClaim): Promise<{ realmId: number }>;
}
export const handleRealmEntryRequest = (request: Request, route: RealmEntryRoute) =>
  playerRequest(request, route, async (player) => {
    const body = await readPlayerBody(
      request,
      Schema.decodeUnknownSync(RealmEntryRequest, { onExcessProperty: "error" }),
      "invalid_realm_entry",
    );
    return route.register({ ...body, ...player, chainId: route.chainId });
  });

interface RealmEntryTarget {
  connection: ShardConnection;
  heraldUrl: string;
  operatorAddress: string;
  privateKey: string;
  identity: {
    accountForRealmsId(id: string): Promise<string | null>;
    linkedWallet(id: string): Promise<string | null>;
    realmOwnerOf(id: string): Promise<string>;
  };
}
type Entitlement = { realm_id: bigint; metadata_1: bigint; metadata_2: bigint; metadata_3: bigint; pass_kind: bigint };

/** Ownership is proved at registration; the shard then binds this immutable identity to one home for the game. */
export async function registerHeldRealm(
  target: RealmEntryTarget,
  claim: RealmEntryClaim,
): Promise<{ realmId: number }> {
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
  await requireHeldWallet(target.identity, claim);
  const operator = new ShardOperator({
    ...target.connection,
    accountAddress: target.operatorAddress,
    privateKey: target.privateKey,
  } satisfies ShardTarget);
  const read = () => operator.view<CairoOption<Entitlement>>("entry_entitlement", [claim.gameId, claim.account]);
  const previous = (await read()).unwrap();
  if (previous) return matchingEntry(previous, claim.realmId);
  if (
    snapshot.models
      .find((model) => model.model === "PlayerEntry")!
      .rows.some(({ value }) => sameFelt(String(value.player), claim.account))
  )
    throw new PlayerRequestError(409, "owner_already_settled");
  if ((await operator.view<bigint>("settled_realm", [claim.gameId, claim.realmId])) !== 0n)
    throw new PlayerRequestError(409, "realm_already_settled");
  await writeRealmEntry(operator, claim);
  const saved = (await read()).unwrap();
  if (!saved) throw new Error("realm_entry_not_recorded");
  return matchingEntry(saved, claim.realmId);
}
async function writeRealmEntry(operator: ShardOperator, claim: RealmEntryClaim) {
  const key = { game_id: claim.gameId, owner: claim.account };
  try {
    await operator.admin("register_entitlement", {
      key,
      entitlement: { realm_id: claim.realmId, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 },
    });
  } catch {
    throw new PlayerRequestError(409, "realm_registration_refused");
  }
}

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

async function requireHeldWallet(identity: RealmEntryTarget["identity"], claim: RealmEntryClaim) {
  const wallet = await identity.linkedWallet(claim.realmsId);
  if (!wallet) throw new PlayerRequestError(409, "realm_wallet_missing");
  if (!sameFelt(await identity.realmOwnerOf(String(claim.realmId)), wallet))
    throw new PlayerRequestError(409, "realm_not_owned");
}

function matchingEntry(entry: Entitlement, realmId: number) {
  if (
    BigInt(entry.realm_id) !== BigInt(realmId) ||
    BigInt(entry.pass_kind) !== 2n ||
    entry.metadata_1 !== 0n ||
    entry.metadata_2 !== 0n ||
    entry.metadata_3 !== 0n
  )
    throw new PlayerRequestError(409, "conflicting_entry_entitlement");
  return { realmId };
}
