import useUIStore from "../../hooks/store/useUIStore";
import { OSWindow } from "./OSWindow";
import { leaderboard } from "./Config";

export const Leaderboard = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(leaderboard));

  return (
    <OSWindow onClick={() => togglePopup(leaderboard)} show={isOpen} title={leaderboard}>
      {/* COMPONENTS GO HERE */}
      hello
    </OSWindow>
  );
};
