import useUIStore from "@/hooks/store/useUIStore";

import { Leaderboard } from "../leaderboard/LeaderBoard";
import { Questing } from "../questing/Questing";
import { Social } from "../social/Social";

export const BottomNavigation = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  return (
    <>
      <div className="pointer-events-auto">
        <Questing entityId={structureEntityId} />

        <Leaderboard />
        <Social />
      </div>
    </>
  );
};
