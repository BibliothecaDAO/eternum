import type { ContractAddress } from "@bibliothecadao/types";

/**
 * Whether the viewer owns a row. The zero address is never a player, so no viewer (null, or 0n before a signer
 * connects) owns anything, and a spectator never owns the rows bandits and mercenaries hold under owner 0n.
 */
export const isViewerOwner = (
  owner: ContractAddress | null | undefined,
  viewer: ContractAddress | null | undefined,
): boolean => viewer !== null && viewer !== undefined && viewer !== 0n && owner === viewer;
