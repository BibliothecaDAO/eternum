import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { leaderboard, resources } from "../../components/navigation/Config";
import { EntityResourceTable } from "../../components/resources/EntityResourceTable";

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
