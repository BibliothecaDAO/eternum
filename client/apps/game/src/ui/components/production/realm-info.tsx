import { CapacityInfo } from "@/ui/modules/navigation/capacity-info";
import { getStructureName } from "@bibliothecadao/eternum";
import { RealmInfo as RealmInfoType, RealmLevels } from "@bibliothecadao/types";
import { memo } from "react";

const CASTLE_IMAGES: Partial<Record<RealmLevels, string>> = {
  1: "/images/buildings/construction/castleOne.png",
  2: "/images/buildings/construction/castleTwo.png",
  3: "/images/buildings/construction/castleThree.png",
} as const;

export const RealmInfo = memo(({ realm }: { realm: RealmInfoType }) => {
  const levelImage = CASTLE_IMAGES[realm.level as unknown as keyof typeof CASTLE_IMAGES];

  return (
    <div className="">
      <div className="grid grid-cols-2">
        <div className="flex items-center gap-2">
          {levelImage && (
            <div className="w-48 h-48 overflow-hidden">
              <img src={levelImage} alt={`Level ${realm.level}`} className="object-contain w-full h-full" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <h1>{getStructureName(realm.structure)} </h1>
            <CapacityInfo structureEntityId={realm.entityId} className="flex flex-row text-xl" />
          </div>
        </div>
      </div>
    </div>
  );
});
