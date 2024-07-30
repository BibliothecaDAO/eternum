import { InventoryResources } from "@/ui/components/resources/InventoryResources";

export const LockedResources = ({
  attackersResourcesEscrowEntityId,
  defendersResourcesEscrowEntityId,
}: {
  attackersResourcesEscrowEntityId: bigint;
  defendersResourcesEscrowEntityId: bigint;
}) => {
  return (
    <div className="col-span-2 flex flex-col justify-start p-2 bg-[#1b1a1a] bg-map overflow-y-auto">
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
