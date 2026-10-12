import { botRealmsId } from "@realms-world/identity/account";
import { joinRealmsAccount, operatorRequest, deviceKeyOf } from "@bibliothecadao/eternum/realms-account";
import { LAUNCHER_LABEL, rpcAt, serviceResponseFailure } from "@realms-world/value-ledger";
import { readLaunchShard } from "./executor";
import type { LaunchEnv } from "./env";

/** The alarm joins with the Worker's own device; the world already names this bot as launcher. */
export async function joinLauncherAccount(
  env: Pick<LaunchEnv, "IDENTITY" | "IDENTITY_HTTP" | "BASE_URL" | "OPERATOR_TOKEN" | "LAUNCH_DEPLOYER_PRIVATE_KEY">,
  chainId: string,
): Promise<string> {
  const { shard } = await readLaunchShard(env.IDENTITY, chainId);
  if (shard.status !== "active") throw new Error("launcher_shard_inactive");
  const account = await joinRealmsAccount({
    provider: rpcAt(shard.rpcUrl) as unknown as Parameters<typeof joinRealmsAccount>[0]["provider"],
    shard,
    realmsId: botRealmsId(LAUNCHER_LABEL),
    device: deviceKeyOf(env.LAUNCH_DEPLOYER_PRIVATE_KEY),
    approve: async (change) => {
      const response = await operatorRequest(
        new URL("/api/devices/bots", env.BASE_URL).href,
        env.OPERATOR_TOKEN,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: LAUNCHER_LABEL, ...change }),
        },
        (url, init) => env.IDENTITY_HTTP.fetch(url, init),
      );
      if (!response.ok) throw await serviceResponseFailure("launcher_approval_refused", response);
      return ((await response.json()) as { signature: string[] }).signature;
    },
  });
  return account.address;
}
