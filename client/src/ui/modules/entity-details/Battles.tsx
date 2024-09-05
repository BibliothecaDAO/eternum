import { useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Position } from "@/types/Position";
import { BattleListItem } from "@/ui/components/battles/BattleListItem";

export const Battles = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const battles = useBattlesByPosition(position.getContract());

  return (
    <div className="px-2 w-[31rem] py-2">
      {battles.length > 0 && (
        <>
          <h5>Battles</h5>
          {battles.map((battle) => (
            <BattleListItem key={battle.entity_id} battle={battle} ownArmySelected={ownArmy} />
          ))}
        </>
      )}
    </div>
  );
};
