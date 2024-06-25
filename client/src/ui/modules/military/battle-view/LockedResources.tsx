import { InventoryResources } from "@/ui/components/resources/InventoryResources";

export const LockedResources = ({
  attackersResourcesEscrowEntityId,
  defendersResourcesEscrowEntityId,
}: {
  attackersResourcesEscrowEntityId: bigint;
  defendersResourcesEscrowEntityId: bigint;
}) => {
  return (
    <div className="col-span-2 flex justify-center flex-wrap ornate-borders-bottom-y p-2 bg-[#1b1a1a] bg-map">
      <div className="text-center w-full text-gold">Battle Chest</div>
      <div className="grid overflow-auto grid-cols-12 gap-2">
        <div className="border-r border-gold/50  col-span-6">
          <InventoryResources entityId={attackersResourcesEscrowEntityId} max={4} />
        </div>
        <div className="col-span-6">
          <InventoryResources entityId={defendersResourcesEscrowEntityId} max={4} />
        </div>
      </div>
    </div>
  );
};
