import Button from "@/ui/elements/Button";
import { EntityList } from "../list/EntityList";

import { useEntityArmies, usePositionArmies } from "@/hooks/helpers/useArmies";
import { currencyFormat } from "@/ui/utils/utils";
import { InventoryResources } from "../resources/InventoryResources";
import { Position } from "@bibliothecadao/eternum";

export const EntityArmyList = ({ entity }: any) => {
  const { entityArmies } = useEntityArmies({ entity_id: entity?.entity_id });

  return (
    <EntityList
      list={entityArmies()}
      title="armies"
      panel={({ entity }) => (
        <>
          <ArmyCard entity={entity} />
          <InventoryResources entityId={entity.entity_id} />
        </>
      )}
    />
  );
};

export const PositionArmyList = ({ position }: { position: Position }) => {
  const { positionArmies } = usePositionArmies({ position });

  return (
    <EntityList
      list={positionArmies()}
      title="armies at position"
      panel={({ entity }) => (
        <>
          <ArmyCard entity={entity} />
          <InventoryResources entityId={entity.entity_id} />
        </>
      )}
    />
  );
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
