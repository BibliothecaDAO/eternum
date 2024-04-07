import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { entityDetails } from "../../components/navigation/Config";
import HexagonInformationPanel from "@/components/worldmap/hexagon/HexagonInformationPanel";

export const EntityDetails = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(entityDetails));

  return (
    <OSWindow onClick={() => togglePopup(entityDetails)} show={isOpen} title={entityDetails}>
      <HexagonInformationPanel />
    </OSWindow>
  );
};
