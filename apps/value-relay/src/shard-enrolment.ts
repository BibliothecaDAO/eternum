import { deviceKeyOf, joinRealmsAccount } from "@bibliothecadao/eternum/realms-account";
import { botRealmsId, realmsAccountAddress } from "@realms-world/identity/account";
import { readRegisteredShard, rpcAt, type ShardDirectory } from "@realms-world/value-ledger";
import { shortString } from "starknet";

const LABEL = shortString.encodeShortString("ETERNUM_VALUE_RELAY");
const REALMS_ID = botRealmsId(LABEL);
interface Target {
  chainId: string;
  heraldUrl: string;
}
interface Environment {
  IDENTITY: ShardDirectory;
  IDENTITY_HTTP: Pick<Fetcher, "fetch">;
  BASE_URL: string;
  OPERATOR_TOKEN: string;
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: string;
}

export const shardOperatorAddress = (shard: { accountClassHash: string; guardianPublicKey: string }) =>
  realmsAccountAddress(REALMS_ID, shard.accountClassHash, shard.guardianPublicKey);

/** Only the relay's fixed bot and Worker-held device can be enrolled through this route. */
export async function enrolShardOperator(env: Environment, input: Target) {
  const shard = await readRegisteredShard(env.IDENTITY, input.chainId);
  if (shard.status === "retired" || new URL(input.heraldUrl).href !== new URL(shard.url).href)
    throw new Error("relay_target_differs");
  const provider = rpcAt(shard.rpcUrl);
  if (BigInt(await provider.getChainId()) !== BigInt(shard.chainId)) throw new Error("relay_chain_differs");
  const response = await env.IDENTITY_HTTP.fetch(new URL("/api/guardian", env.BASE_URL));
  if (!response.ok) throw new Error("relay_identity_unavailable");
  const pins = (await response.json()) as { accountClassHash: string; publicKey: string };
  if (
    BigInt(pins.accountClassHash) !== BigInt(shard.accountClassHash) ||
    BigInt(pins.publicKey) !== BigInt(shard.guardianPublicKey)
  )
    throw new Error("relay_identity_differs");
  const account = await joinRealmsAccount({
    provider: provider as unknown as Parameters<typeof joinRealmsAccount>[0]["provider"],
    shard,
    realmsId: REALMS_ID,
    device: deviceKeyOf(env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY),
    approve: async (change) => {
      const approval = await env.IDENTITY_HTTP.fetch(new URL("/api/devices/bots", env.BASE_URL), {
        method: "POST",
        headers: { authorization: `Bearer ${env.OPERATOR_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ label: LABEL, ...change }),
        redirect: "error",
      });
      if (!approval.ok) throw new Error("relay_device_approval_refused");
      return ((await approval.json()) as { signature: string[] }).signature;
    },
  });
  if (BigInt(account.address) !== BigInt(shardOperatorAddress(shard))) throw new Error("relay_account_differs");
  return { chainId: shard.chainId, ledgerOperatorAccount: account.address };
}
