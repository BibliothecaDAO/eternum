import { belongsToActiveGame } from "@bibliothecadao/eternum";
import type { ClientComponents } from "@bibliothecadao/types";
import { type Entity, getComponentValue } from "@dojoengine/recs";

type BlitzSettlementComponents = Pick<ClientComponents, "BlitzSettlement">;

export const filterPlayersByBlitzSettlement = <Player extends { address: bigint }>(
  players: readonly Player[],
  settledPlayerAddresses: readonly bigint[],
): Player[] => {
  const settledPlayers = new Set(settledPlayerAddresses);
  return players.filter((player) => settledPlayers.has(player.address));
};

export const readBlitzSettlementPlayerAddresses = (
  components: BlitzSettlementComponents,
  blitzSettlementEntities: Entity[],
): bigint[] =>
  blitzSettlementEntities
    .map((entityId) => getComponentValue(components.BlitzSettlement, entityId))
    .filter((settlement): settlement is NonNullable<typeof settlement> => belongsToActiveGame(settlement))
    .map((settlement) => settlement.player as unknown as bigint);
