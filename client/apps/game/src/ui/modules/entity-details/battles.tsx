import { BattleInfo } from "@/hooks/helpers/battles/use-battles";
import { BattleListItem } from "@/ui/components/battles/battle-list-item";
import { ArmyInfo } from "@bibliothecadao/eternum";

export const Battles = ({ ownArmy, battles }: { ownArmy: ArmyInfo | undefined; battles: BattleInfo[] }) => {
  return (
    <div className="w-[31rem] py-2 pl-2">
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
