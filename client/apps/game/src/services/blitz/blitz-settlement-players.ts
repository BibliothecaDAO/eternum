import { belongsToActiveGame } from "@bibliothecadao/eternum";
import type { ClientComponents } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { type Entity, getComponentValue, Has } from "@dojoengine/recs";
import { useMemo } from "react";

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

export const useBlitzSettlementPlayerAddresses = (components: BlitzSettlementComponents): bigint[] => {
  const blitzSettlementEntities = useEntityQuery([Has(components.BlitzSettlement)]);

  return useMemo(
    () => readBlitzSettlementPlayerAddresses(components, blitzSettlementEntities),
    [blitzSettlementEntities, components.BlitzSettlement],
  );
};
