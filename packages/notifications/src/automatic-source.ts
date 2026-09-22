import type { LocalNotificationPayload } from "./delivery";

/** A shard whose game activity a device receives: its chain id and the contract its games run in. */
export interface AutomaticPushSource {
  chainId: string;
  worldAddress: string;
}
export function parseAutomaticPushSource(value: unknown): AutomaticPushSource {
  if (typeof value === "string") {
    const [chainId, worldAddress, extra] = value.split(":");
    if (extra !== undefined) throw new Error("Invalid automatic push source");
    return parseAutomaticPushSource({ chainId, worldAddress });
  }
  if (!value || typeof value !== "object") throw new Error("Invalid automatic push source");
  const source = value as AutomaticPushSource;
  if (
    typeof source.chainId !== "string" ||
    !/^0x[0-9a-f]{1,64}$/i.test(source.chainId) ||
    typeof source.worldAddress !== "string" ||
    !/^0x[0-9a-f]{1,64}$/i.test(source.worldAddress) ||
    BigInt(source.worldAddress) <= 0n ||
    BigInt(source.worldAddress) >= (1n << 251n) + 17n * (1n << 192n) + 1n
  )
    throw new Error("Invalid automatic push source");
  return {
    chainId: `0x${BigInt(source.chainId).toString(16)}`,
    worldAddress: `0x${BigInt(source.worldAddress).toString(16)}`,
  };
}
export function automaticPushSourceKey(value: AutomaticPushSource): string {
  const source = parseAutomaticPushSource(value);
  return `${source.chainId}:${source.worldAddress}`;
}
/** Matches the existing versioned StoryEvent identity; it never generates an alternative event identity. */
export function notificationMatchesSource(
  notification: LocalNotificationPayload,
  source: AutomaticPushSource,
): boolean {
  return (
    notification.id.startsWith(`story:v1:${source.chainId}:${source.worldAddress}:`) &&
    notification.target.startsWith(`/enter/${source.chainId}/`)
  );
}
