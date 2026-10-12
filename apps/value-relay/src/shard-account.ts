import { deviceKeyOf, joinRealmsAccount } from "@bibliothecadao/eternum/realms-account";
import { botRealmsId } from "@realms-world/identity/account";
import {
  readRegisteredShard,
  rpcAt,
  RELAY_LABEL,
  serviceResponseFailure,
  type ShardDirectory,
} from "@realms-world/value-ledger";

interface Environment {
  IDENTITY: ShardDirectory;
  IDENTITY_HTTP: Pick<Fetcher, "fetch">;
  BASE_URL: string;
  OPERATOR_TOKEN: string;
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: string;
}

/** The cron joins with its own device; the world already names this bot as ledger operator. */
export async function joinShardOperator(env: Environment, chainId: string) {
  const shard = await readRegisteredShard(env.IDENTITY, chainId);
  if (shard.status !== "active") throw new Error("relay_shard_inactive");
  const provider = rpcAt(shard.rpcUrl);
  const account = await joinRealmsAccount({
    provider: provider as unknown as Parameters<typeof joinRealmsAccount>[0]["provider"],
    shard,
    realmsId: botRealmsId(RELAY_LABEL),
    device: deviceKeyOf(env.SHARD_LEDGER_OPERATOR_PRIVATE_KEY),
    approve: async (change) => {
      const approval = await env.IDENTITY_HTTP.fetch(new URL("/api/devices/bots", env.BASE_URL), {
        method: "POST",
        headers: { authorization: `Bearer ${env.OPERATOR_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ label: RELAY_LABEL, ...change }),
        redirect: "error",
      });
      if (!approval.ok) throw await serviceResponseFailure("relay_device_approval_refused", approval);
      return ((await approval.json()) as { signature: string[] }).signature;
    },
  });
  return account.address;
}
