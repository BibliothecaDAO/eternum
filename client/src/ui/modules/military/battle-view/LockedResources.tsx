import { useResources } from "@/hooks/helpers/useResources";
import { InventoryResources } from "@/ui/components/resources/InventoryResources";
import React from "react";

export const LockedResources = ({
  attackersResourcesEscrowEntityId,
  defendersResourcesEscrowEntityId,
}: {
  attackersResourcesEscrowEntityId: bigint;
  defendersResourcesEscrowEntityId: bigint;
}) => {
  const { getResourcesFromBalance } = useResources();

  const attackersResources = getResourcesFromBalance(attackersResourcesEscrowEntityId);
  const defendersResources = getResourcesFromBalance(attackersResourcesEscrowEntityId);

  return (
    <div className="col-span-2 flex justify-center flex-wrap ornate-borders-bottom-y p-2 bg-[#1b1a1a] bg-map">
      <div className="text-center w-full text-gold">Battle Chest</div>
      {attackersResources.length > 0 && defendersResources.length > 0 ? (
        <div className="grid overflow-auto grid-cols-12 gap-2">
          <React.Fragment>
            <div className="border-r border-gold/50  col-span-6">
              <InventoryResources entityId={attackersResourcesEscrowEntityId} max={4} />
            </div>
            <div className="col-span-6">
              <InventoryResources entityId={defendersResourcesEscrowEntityId} max={4} />
            </div>
          </React.Fragment>
        </div>
      ) : (
        <div className="text-xl text-gold w-full px-2 text-center">Empty</div>
      )}
    </div>
  );
};
