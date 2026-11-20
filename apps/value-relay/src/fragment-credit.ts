import { Schema } from "effect";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { hash } from "starknet";
import { sameFelt, type ShardConnection } from "./shard-rpc";
import { PlayerRequestError } from "./player-request";

export const FriendCredit = Schema.Struct({
  chainId: Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-f]{1,64}$/i))),
  gameId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 0xffffffff }))),
  realmsId: Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-f]{1,64}$/i))),
  id: Schema.String.pipe(Schema.check(Schema.isPattern(/^[!-~]{1,200}$/))),
  amount: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 1_000_000 }))),
});
export type FriendCredit = typeof FriendCredit.Type;

interface FragmentCreditTarget {
  connection: ShardConnection;
  operatorAddress: string;
  privateKey: string;
  identity: { accountForRealmsId(id: string): Promise<string | null> };
}

export async function creditFriendFragments(target: FragmentCreditTarget, credit: FriendCredit) {
  if (!sameFelt(target.connection.chainId, credit.chainId)) throw new PlayerRequestError(409, "shard_chain_differs");
  const account = await target.identity.accountForRealmsId(credit.realmsId);
  if (!account) throw new PlayerRequestError(404, "account_unavailable");
  const operator = new ShardOperator({
    ...target.connection,
    accountAddress: target.operatorAddress,
    privateKey: target.privateKey,
  } satisfies ShardTarget);
  const onChain = {
    id: hash.starknetKeccak(credit.id).toString(),
    account,
    amount: credit.amount,
  };
  try {
    await operator.admin("credit_fragments", { game_id: credit.gameId, credit: onChain });
  } catch {
    throw new PlayerRequestError(503, "fragment_credit_unavailable");
  }
  return { id: onChain.id };
}
