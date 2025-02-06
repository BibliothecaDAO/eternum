import { CapacityInfo, StorehouseInfo } from "@/ui/modules/navigation/capacity-info";
import { RealmInfo as RealmInfoType, StructureType } from "@bibliothecadao/eternum";

export const RealmInfo = ({ realm }: { realm: RealmInfoType }) => {
  return (
    <div className="bg-brown/20 p-4 rounded-lg space-y-4">
      <h3 className="text-2xl font-bold">Realm Info</h3>

      {/* Capacity and Level Info in a styled container */}
      <div className="bg-brown/30 rounded-lg p-3 space-y-2">
        <div className="text-lg">
          <span className="text-gold/80">Level:</span>
          <span className="ml-2">{realm.level}</span>
        </div>
        <CapacityInfo structureEntityId={realm.entityId} structureCategory={StructureType.Realm} />
        <StorehouseInfo storehouseCapacity={realm.storehouses.capacityKg} />
      </div>
    </div>
  );
};
