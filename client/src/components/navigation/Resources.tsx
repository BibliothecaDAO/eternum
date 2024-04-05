import useUIStore from "../../hooks/store/useUIStore";
import { OSWindow } from "./OSWindow";
import { leaderboard, resources } from "./Config";

export const Resources = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(resources));

  return (
    <OSWindow onClick={() => togglePopup(resources)} show={isOpen} title={resources}>
      {/* COMPONENTS GO HERE */}
      Entity Resources
    </OSWindow>
  );
};
