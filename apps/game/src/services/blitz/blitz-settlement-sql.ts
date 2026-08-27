import { appchainModel } from "@/dojo/game-scope";

/**
 * Blitz settlement lookups against a CHOSEN game's rows, used from the
 * landing side before (or outside) any bootstrap scope. Callers pass the
 * explicit game id they target — registration is about the game the player
 * picked, never the ambient scope — and the shared appchain world filters
 * `BlitzSettlement` by `game_id`.
 *
 * `gameId` is optional only to keep dead legacy callers compiling until the
 * W7 excision; an absent id disables the filter and must never be reached on
 * a live path.
 */

const settlementTable = () => appchainModel("BlitzSettlement");

const gameFilter = (gameId: number | null | undefined, alias?: string) =>
  gameId && gameId > 0 ? `${alias ? `${alias}.` : ""}game_id = ${gameId}` : "1=1";

const buildAddressMatchCondition = (columnName: string, playerAddress: string) =>
  `ltrim(lower(CAST(${columnName} AS TEXT)), '0x') = ltrim(lower('${playerAddress}'), '0x')`;

export const buildPlayerBlitzSettlementStatusQuery = (playerAddress: string, gameId?: number | null) => `
  SELECT player
  FROM "${settlementTable()}"
  WHERE ${gameFilter(gameId)} AND ${buildAddressMatchCondition("player", playerAddress)}
  LIMIT 1;
`;

export const buildPlayerBlitzSettlementSnapshotQuery = (playerAddress: string, gameId?: number | null) => `
  SELECT player, structure_ids
  FROM "${settlementTable()}"
  WHERE ${gameFilter(gameId)} AND ${buildAddressMatchCondition("player", playerAddress)}
  LIMIT 1;
`;

/** Structures the player owns inside the chosen game — the settle flow's lag-tolerant progress signal. */
export const buildPlayerOwnedStructureCountQuery = (playerAddress: string, gameId?: number | null) => `
  SELECT COUNT(*) AS owned_count
  FROM "${appchainModel("Structure")}"
  WHERE ${gameFilter(gameId)} AND ${buildAddressMatchCondition("owner", playerAddress)}
  LIMIT 1;
`;

export const buildSettledBlitzPlayersQuery = (gameId?: number | null) => `
  SELECT DISTINCT player
  FROM "${settlementTable()}"
  WHERE ${gameFilter(gameId)};
`;
