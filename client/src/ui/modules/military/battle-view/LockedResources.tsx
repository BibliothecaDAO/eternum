import { InventoryResources } from "@/ui/components/resources/InventoryResources";

export const LockedResources = ({
  attackersResourcesEscrowEntityId,
  defendersResourcesEscrowEntityId,
}: {
  attackersResourcesEscrowEntityId: bigint;
  defendersResourcesEscrowEntityId: bigint;
}) => {
  return (
    <div className="flex flex-col w-[30vw] text-gold border-gold  bg-brown border-gradient border-2 clip-angled ornate-borders p-1">
      <div className="text-center">Battle Chest</div>
      <div className="flex flex-row overflow-auto">
        <div className="border-r w-[7vw] mx-1">
          <InventoryResources entityId={attackersResourcesEscrowEntityId} />
        </div>
        <div className="w-[7vw]  mx-1">
          <InventoryResources entityId={defendersResourcesEscrowEntityId} />
        </div>
      </div>
    </div>
  );
};
