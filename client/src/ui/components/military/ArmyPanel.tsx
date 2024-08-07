import { PlayerStructure } from "@/hooks/helpers/useEntities";
import { EntityArmyList } from "./ArmyList";

export const ArmyPanel = ({ structure }: { structure: PlayerStructure }) => {
  return (
    <div>
      <div className="flex justify-between">
        <h3>{structure.name}</h3>
      </div>

      <EntityArmyList structure={structure} />
    </div>
  );
};
