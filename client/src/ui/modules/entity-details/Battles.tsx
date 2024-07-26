import { useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { BattleListItem } from "@/ui/components/battles/BattleListItem";
import { Position } from "@bibliothecadao/eternum";

export const Battles = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const battles = useBattlesByPosition(position);

  return (
    battles.length > 0 && (
      <div className="px-2 w-[31rem] py-2">
        Battles
        {battles.map((battle) => (
          <BattleListItem key={battle.entity_id} battle={battle} ownArmySelected={ownArmy} />
        ))}
      </div>
    )
  );
};
