import { CapacityInfo } from "@/ui/modules/navigation/capacity-info";
import { RealmInfo as RealmInfoType, StructureType } from "@bibliothecadao/eternum";
import { memo } from "react";

export const RealmInfo = memo(({ realm }: { realm: RealmInfoType }) => {
  return (
    <div className="bg-brown/20 p-4 rounded-lg space-y-4">
      <h3 className="text-2xl font-bold">Realm Info</h3>

      <div className="bg-brown/30 rounded-lg p-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-gold/80 text-sm">Level</span>
            <span className="text-lg">{realm.level}</span>
          </div>

          <CapacityInfo
            structureEntityId={realm.entityId}
            structureCategory={StructureType.Realm}
            className="flex flex-row gap-4"
          />
        </div>
      </div>
    </div>
  );
});
