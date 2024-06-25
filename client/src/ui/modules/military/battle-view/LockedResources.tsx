import { InventoryResources } from "@/ui/components/resources/InventoryResources";

export const LockedResources = ({
  attackersResourcesEscrowEntityId,
  defendersResourcesEscrowEntityId,
}: {
  attackersResourcesEscrowEntityId: bigint;
  defendersResourcesEscrowEntityId: bigint;
}) => {
  return (
    <div className="grid col-span-2  bg-[#1b1a1a] clip-angled ornate-borders p-1 row-auto ">
      <div className="text-center w-full text-gold">Battle Chest</div>
      <div className="grid overflow-auto grid-cols-12 gap-2">
        <div className="border-r border-gold/50  col-span-6">
          <InventoryResources entityId={attackersResourcesEscrowEntityId} max={4} />
        </div>
        <div className="    col-span-6">
          <InventoryResources entityId={defendersResourcesEscrowEntityId} max={4} />
        </div>
      </div>
    </div>
  );
};
