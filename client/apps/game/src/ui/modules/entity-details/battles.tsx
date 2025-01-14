import { BattleListItem } from "@/ui/components/battles/battle-list-item";
import { ArmyInfo, ID } from "@bibliothecadao/eternum";

export const Battles = ({ ownArmy, battles }: { ownArmy: ArmyInfo | undefined; battles: ID[] }) => {
  return (
    <div className="w-[31rem] py-2 pl-2">
      {battles.length > 0 && (
        <>
          <h5>Battles</h5>
          {battles.map((battle) => (
            <BattleListItem key={battle} battleEntityId={battle} ownArmySelected={ownArmy} />
          ))}
        </>
      )}
    </div>
  );
};
