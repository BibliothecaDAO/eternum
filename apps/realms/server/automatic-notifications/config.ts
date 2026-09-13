import { GAME_CHAIN_NAMES, resolveEndpoint, type GameChain } from "@realms-world/chain";

export function resolveAutomaticNotificationConfig(env: {
  WEB_PUSH_AUTOMATIC_ENABLED?: string | undefined;
  WEB_PUSH_ENABLED?: string | undefined;
  NOTIFICATION_HERALD_URL?: string | undefined;
  NOTIFICATION_CHAIN?: string | undefined;
  NOTIFICATION_WORLD_ADDRESS?: string | undefined;
}) {
  if (env.WEB_PUSH_AUTOMATIC_ENABLED && !["true", "false"].includes(env.WEB_PUSH_AUTOMATIC_ENABLED))
    throw new Error("WEB_PUSH_AUTOMATIC_ENABLED must be true or false");
  if (env.WEB_PUSH_AUTOMATIC_ENABLED !== "true") return null;
  if (env.WEB_PUSH_ENABLED !== "true") throw new Error("Automatic notifications require Web Push to be enabled");
  if (!env.NOTIFICATION_CHAIN || !Object.hasOwn(GAME_CHAIN_NAMES, env.NOTIFICATION_CHAIN))
    throw new Error("Automatic notifications require a supported source chain");
  if (
    !env.NOTIFICATION_WORLD_ADDRESS ||
    !/^0x[0-9a-f]+$/i.test(env.NOTIFICATION_WORLD_ADDRESS) ||
    BigInt(env.NOTIFICATION_WORLD_ADDRESS) === 0n
  )
    throw new Error("Automatic notifications require a world address");
  const url = resolveEndpoint(env.NOTIFICATION_HERALD_URL, {
    name: "NOTIFICATION_HERALD_URL",
    browserFacing: false,
  }).replace(/\/$/, "");
  return {
    url,
    chain: env.NOTIFICATION_CHAIN as GameChain,
    worldAddress: `0x${BigInt(env.NOTIFICATION_WORLD_ADDRESS).toString(16)}`,
  };
}
