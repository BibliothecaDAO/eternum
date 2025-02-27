import { Position } from "@/types/position";
import { StructureCard } from "@/ui/components/structures/worldmap/structure-card";
import { Checkbox } from "@/ui/elements/checkbox";
import { ArmyInfo } from "@bibliothecadao/eternum";
import { useState } from "react";

export const Entities = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const [showStructure, setShowStructure] = useState(true);
  const [showArmies, setShowArmies] = useState(true);

  return (
    <div className="pb-2">
      <div className="w-full grid grid-cols-3">
        <Checkbox enabled={showStructure} onClick={() => setShowStructure((prev) => !prev)} text="Show structure" />
        <Checkbox enabled={showArmies} onClick={() => setShowArmies((prev) => !prev)} text="Show armies" />
      </div>
      {showStructure && <StructureCard position={position} ownArmySelected={ownArmy} />}
    </div>
  );
};
