import { useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Position } from "@bibliothecadao/eternum";
import { BattleListItem } from "./BattleListItem";

export const BattleCard = ({
  position,
  ownArmySelected,
}: {
  position: Position;
  ownArmySelected: ArmyInfo | undefined;
}) => {
  const battles = useBattlesByPosition(position);

  return (
    battles.length > 0 && (
      <div className="px-2 w-[31rem] py-2">
        Battles
        {battles.map((battle) => (
          <BattleListItem key={battle.entity_id} battle={battle} ownArmySelected={ownArmySelected} />
        ))}
      </div>
    )
  );
};
