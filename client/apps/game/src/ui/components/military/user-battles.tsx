import { BattleListItem } from "@/ui/components/battles/battle-list-item";
import { usePlayerBattles } from "@bibliothecadao/react";

export const UserBattles = () => {
  const battleEntityIds = usePlayerBattles();

  return (
    <div className="w-[31rem] py-2 pl-2">
      {battleEntityIds.length > 0 && (
        <>
          <h5>Your battles</h5>
          {battleEntityIds
            // .sort((a, b) => Number(a.duration_left) - Number(b.duration_left))
            .map((id) => (
              <BattleListItem key={id} battleEntityId={id} showCompass />
            ))}
        </>
      )}
    </div>
  );
};
