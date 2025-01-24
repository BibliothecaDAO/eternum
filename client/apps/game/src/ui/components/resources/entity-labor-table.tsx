import { ID, LaborIds, ResourcesIds } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { LaborChip } from "./labor-chip";

export const EntityLaborTable = ({ entityId }: { entityId: ID | undefined }) => {
  const dojo = useDojo();

  if (!entityId || entityId === 0) {
    return <div>No Entity Selected</div>;
  }

  const startProduction = async (resourceType: ResourcesIds, producedAmount: number) => {
    try {
      await dojo.setup.systemCalls.start_production({
        signer: dojo.account.account,
        entity_id: entityId,
        resource_type: resourceType,
        amount: producedAmount,
      });
    } catch (error) {
      console.error("Failed to start production", error);
    }
  };

  return Object.entries(LaborIds).map(([_, laborId]) => {
    if (isNaN(Number(laborId))) return null;
    return <LaborChip key={laborId} laborId={laborId as LaborIds} startProduction={startProduction} />;
  });
};
