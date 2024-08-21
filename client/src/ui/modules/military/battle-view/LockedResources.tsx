import { InventoryResources } from "@/ui/components/resources/InventoryResources";
import { ID } from "@bibliothecadao/eternum";

export const LockedResources = ({
  attackersResourcesEscrowEntityId,
  defendersResourcesEscrowEntityId,
}: {
  attackersResourcesEscrowEntityId: ID;
  defendersResourcesEscrowEntityId: ID;
}) => {
  return (
    <div className="col-span-2 flex flex-col justify-start p-2 bg-[#1b1a1a] bg-hex-bg overflow-y-auto">
      <div className="w-full text-center text-gold mb-2">Battle Chest</div>
      <InventoryResources
        textSize="xxs"
        resourcesIconSize="sm"
        className="grid grid-cols-3 gap-1"
        entityIds={[attackersResourcesEscrowEntityId, defendersResourcesEscrowEntityId]}
      />
    </div>
  );
};
