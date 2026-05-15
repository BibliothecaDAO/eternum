import type { ClientComponents } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { type Entity, getComponentValue, Has } from "@dojoengine/recs";
import { useMemo } from "react";

type BlitzSettlementComponents = Pick<ClientComponents, "BlitzSettlement">;

export const readBlitzSettlementPlayerAddresses = (
  components: BlitzSettlementComponents,
  blitzSettlementEntities: Entity[],
): bigint[] =>
  blitzSettlementEntities
    .map((entityId) => getComponentValue(components.BlitzSettlement, entityId))
    .filter((settlement): settlement is NonNullable<typeof settlement> => Boolean(settlement))
    .map((settlement) => settlement.player as unknown as bigint);

export const useBlitzSettlementPlayerAddresses = (components: BlitzSettlementComponents): bigint[] => {
  const blitzSettlementEntities = useEntityQuery([Has(components.BlitzSettlement)]);

  return useMemo(
    () => readBlitzSettlementPlayerAddresses(components, blitzSettlementEntities),
    [blitzSettlementEntities, components.BlitzSettlement],
  );
};
