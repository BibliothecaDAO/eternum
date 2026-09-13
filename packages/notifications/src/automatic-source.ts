import { GAME_CHAIN_NAMES, type GameChain } from "@realms-world/chain";
import type { LocalNotificationPayload } from "./delivery";

export interface AutomaticPushSource {
  chain: GameChain;
  worldAddress: string;
}
export function parseAutomaticPushSource(value: unknown): AutomaticPushSource {
  if (typeof value === "string") {
    const [chain, worldAddress, extra] = value.split(":");
    if (extra !== undefined) throw new Error("Invalid automatic push source");
    return parseAutomaticPushSource({ chain, worldAddress });
  }
  if (!value || typeof value !== "object") throw new Error("Invalid automatic push source");
  const source = value as AutomaticPushSource;
  if (
    typeof source.chain !== "string" ||
    !Object.hasOwn(GAME_CHAIN_NAMES, source.chain) ||
    typeof source.worldAddress !== "string" ||
    !/^0x[0-9a-f]{1,64}$/i.test(source.worldAddress) ||
    BigInt(source.worldAddress) <= 0n ||
    BigInt(source.worldAddress) >= (1n << 251n) + 17n * (1n << 192n) + 1n
  )
    throw new Error("Invalid automatic push source");
  return { chain: source.chain, worldAddress: `0x${BigInt(source.worldAddress).toString(16)}` };
}
export function automaticPushSourceKey(value: AutomaticPushSource): string {
  const source = parseAutomaticPushSource(value);
  return `${source.chain}:${source.worldAddress}`;
}
/** Matches the existing versioned StoryEvent identity; it never generates an alternative event identity. */
export function notificationMatchesSource(
  notification: LocalNotificationPayload,
  source: AutomaticPushSource,
): boolean {
  return (
    notification.id.startsWith(`story:v1:${encodeURIComponent(source.chain)}:${source.worldAddress}:`) &&
    notification.target.startsWith(`/enter/${source.chain}/`)
  );
}
