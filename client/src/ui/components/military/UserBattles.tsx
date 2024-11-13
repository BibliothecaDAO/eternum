import { useUserBattles } from "@/hooks/helpers/battles/useBattles";
import { BattleListItem } from "../battles/BattleListItem";

export const UserBattles = () => {
  const battles = useUserBattles();

  return (
    <div className="w-[31rem] py-2 pl-2">
      {battles.length > 0 && (
        <>
          <h5>Your battles</h5>
          {battles.map((battle) => (
            <BattleListItem key={battle.entity_id} battle={battle} ownArmySelected={undefined} showCompass />
          ))}
        </>
      )}
    </div>
  );
};
