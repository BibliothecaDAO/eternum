import { ContractAddress } from "@bibliothecadao/types";
import { configManager, isViewerOwner, nativeGameModeOf } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

// Addresses reach this comparison in every felt spelling the stack produces — padded from the gameplay account
// (`addAddressPadding`), unpadded from herald rows, bigint from native facts — so equality is numeric, never textual.
const toAddress = (value: unknown): bigint | null => {
  if (typeof value !== "string" && typeof value !== "bigint" && typeof value !== "number") return null;
  try {
    return ContractAddress(typeof value === "number" ? BigInt(value) : value);
  } catch {
    return null;
  }
};

export const isEntityOwnedByAccount = (
  store: NativeFactStore | null | undefined,
  entityId: number,
  accountAddress: string | undefined,
): boolean => {
  if (!store || !Number.isSafeInteger(entityId) || entityId <= 0 || !accountAddress) return false;
  try {
    const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
    return isViewerOwner(toAddress(structure?.owner), toAddress(accountAddress));
  } catch {
    return false;
  }
};

/**
 * Whether two players are allies: tribe members, in Eternum only (owner, 2026-10-21: "no allies in frontier/blitz but in
 * eternum yes, tribe members"). The chain lets a tribe form in any mode (guilds.cairo checks no mode), so the mode is read
 * here, in the one rule every map label, token and minimap mark takes its side from; elsewhere a tribe makes no ally.
 */
export function arePlayersAllied(
  store: NativeFactStore | null | undefined,
  playerAddress: bigint | string | null | undefined,
  ownerAddress: bigint | string | undefined,
): boolean {
  const player = toAddress(playerAddress);
  const owner = toAddress(ownerAddress);
  if (!store || !player || !owner || player === owner) return false;
  if (nativeGameModeOf(configManager.getPresetId()) !== "eternum") return false;
  const playerGuild = store.get("GuildMember", { game_id: configManager.getActiveGameId(), actor: player })?.guild_id;
  if (!playerGuild) return false;
  return store.get("GuildMember", { game_id: configManager.getActiveGameId(), actor: owner })?.guild_id === playerGuild;
}
