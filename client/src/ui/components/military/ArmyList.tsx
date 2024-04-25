import Button from "@/ui/elements/Button";
import { EntityList } from "../list/EntityList";

import { useArmies } from "@/hooks/helpers/useArmies";
import { currencyFormat } from "@/ui/utils/utils";

export const ArmyList = ({ entity }: any) => {
  const { entityArmies } = useArmies({ entity_id: entity?.entity_id });

  return <EntityList list={entityArmies()} title="armies" panel={({ entity }) => <ArmyCard entity={entity} />} />;
};

// TODO: Position, Combine Armies, Travel to on Map
export const ArmyCard = ({ entity }: any) => {
  return (
    <div className="flex">
      <img className="w-1/3" src="/images/units/troop.png" alt="" />
      <div className="p-3 space-y-2">
        <div className="flex">
          <h4>Knights: {currencyFormat(entity.troops.knight_count, 2)}</h4>
        </div>
        <div>
          <h4>Paladins: {currencyFormat(entity.troops.paladin_count, 2)}</h4>
        </div>
        <div>
          <h4>Crossbowman: {currencyFormat(entity.troops.crossbowman_count, 2)}</h4>
        </div>
      </div>
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
