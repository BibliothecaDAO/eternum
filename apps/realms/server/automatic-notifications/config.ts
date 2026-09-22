import { expectedChainId, resolveEndpoint } from "@realms-world/chain";
import { readShardManifest } from "@realms-world/chain/shard-manifest";

export function resolveAutomaticNotificationConfig(env: {
  WEB_PUSH_AUTOMATIC_ENABLED?: string | undefined;
  WEB_PUSH_ENABLED?: string | undefined;
  NOTIFICATION_HERALD_URL?: string | undefined;
  NATIVE_WORLD_MANIFEST?: string | undefined;
}) {
  if (env.WEB_PUSH_AUTOMATIC_ENABLED && !["true", "false"].includes(env.WEB_PUSH_AUTOMATIC_ENABLED))
    throw new Error("WEB_PUSH_AUTOMATIC_ENABLED must be true or false");
  if (env.WEB_PUSH_AUTOMATIC_ENABLED !== "true") return null;
  if (env.WEB_PUSH_ENABLED !== "true") throw new Error("Automatic notifications require Web Push to be enabled");
  const manifest = readShardManifest(env.NATIVE_WORLD_MANIFEST);
  const worldAddress = (manifest as { world?: { address?: string } }).world?.address;
  if (!worldAddress || !/^0x[0-9a-f]+$/i.test(worldAddress) || BigInt(worldAddress) === 0n)
    throw new Error("Automatic notifications require a deployed shard manifest");
  const url = resolveEndpoint(env.NOTIFICATION_HERALD_URL, {
    name: "NOTIFICATION_HERALD_URL",
    browserFacing: false,
  }).replace(/\/$/, "");
  return {
    url,
    chainId: expectedChainId(manifest),
    worldAddress: `0x${BigInt(worldAddress).toString(16)}`,
  };
}
