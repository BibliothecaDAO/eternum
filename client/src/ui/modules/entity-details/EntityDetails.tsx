import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { entityDetails } from "../../components/navigation/Config";
import HexagonInformationPanel from "@/ui/components/worldmap/hexagon/HexagonInformationPanel";

export const EntityDetails = () => {
  const { togglePopup } = useUIStore();

  // const isOpen = useUIStore((state) => state.isPopupOpen(entityDetails));
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const clickedHex = useUIStore((state) => state.clickedHex);
  const isOpen = clickedHex !== undefined;

  const onClose = () => {
    togglePopup(entityDetails);
    setClickedHex(undefined);
  };

  return (
    <OSWindow width="600px" onClick={onClose} show={isOpen} title={"Location Details"}>
      <HexagonInformationPanel />
    </OSWindow>
  );
};
