import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { leaderboard } from "../../components/navigation/Config";
import { LeaderboardPanel } from "@/ui/components/worldmap/leaderboard/LeaderboardPanel";

export const Leaderboard = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(leaderboard));

  return (
    <OSWindow onClick={() => togglePopup(leaderboard)} show={isOpen} title={leaderboard}>
      {/* COMPONENTS GO HERE */}
      <LeaderboardPanel />
    </OSWindow>
  );
};
