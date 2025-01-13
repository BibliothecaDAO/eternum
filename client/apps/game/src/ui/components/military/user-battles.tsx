import { useUserBattles } from "@/hooks/helpers/battles/use-battles";
import { BattleListItem } from "@/ui/components/battles/battle-list-item";

export const UserBattles = () => {
  const battles = useUserBattles();

  return (
    <div className="w-[31rem] py-2 pl-2">
      {battles.length > 0 && (
        <>
          <h5>Your battles</h5>
          {battles
            .sort((a, b) => Number(a.duration_left) - Number(b.duration_left))
            .map((battle) => (
              <BattleListItem key={battle.entity_id} battle={battle} ownArmySelected={undefined} showCompass />
            ))}
        </>
      )}
    </div>
  );
};
