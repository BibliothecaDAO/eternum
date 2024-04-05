import useUIStore from "../../hooks/store/useUIStore";
import { OSWindow } from "./OSWindow";
import { leaderboard, resources } from "./Config";
import { EntityResourceTable } from "../resources/EntityResourceTable";

export const Resources = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(resources));

  return (
    <OSWindow onClick={() => togglePopup(resources)} show={isOpen} title={resources}>
      {/* COMPONENTS GO HERE */}
      <EntityResourceTable />
    </OSWindow>
  );
};
