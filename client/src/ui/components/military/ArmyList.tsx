import Button from "@/ui/elements/Button";
import { EntityList } from "../list/EntityList";

import { useArmies } from "@/hooks/helpers/useArmies";

export const ArmyList = ({ entity }: any) => {
  const { entityArmies } = useArmies({ entity_id: entity?.entity_id });

  return <EntityList list={entityArmies()} title="armies" panel={({ entity }) => <ArmyCard entity={entity} />} />;
};

// TODO: Position, Combine Armies, Travel to on Map
export const ArmyCard = ({ entity }: any) => {
  return (
    <div>
      <div>Knights: {entity.troops.knight_count}</div>
      <div>Paladins: {entity.troops.knight_count}</div>
      <div>Crossbowman: {entity.troops.knight_count}</div>
    </div>
  );
};

export const TroopCard = ({}) => {
  const troops = [
    { id: 1, name: "Knights", quantity: 10 },
    { id: 2, name: "Crossbowmen", quantity: 10 },
    { id: 3, name: "Paladin", quantity: 10 },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {troops.map((troop) => (
        <div className="border p-3">
          {troop.name} - {troop.quantity}
        </div>
      ))}
    </div>
  );
};

export const ArmyStatistics = ({}) => {
  return (
    <div className="flex space-x-4 ">
      <div>Atk: 30</div>
      <div>Def: 30</div>
      <div>HP: 30</div>
    </div>
  );
};
