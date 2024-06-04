import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { entityDetails } from "../../components/navigation/Config";
import HexagonInformationPanel from "@/ui/components/worldmap/hexagon/HexagonInformationPanel";
import Button from "@/ui/elements/Button";

export const EntityDetails = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  // const isOpen = useUIStore((state) => state.isPopupOpen(entityDetails));
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const clickedHex = useUIStore((state) => state.clickedHex);
  const isOpen = clickedHex !== undefined;

  const battleView = useUIStore((state) => state.battleView);
  const setBattleView = useUIStore((state) => state.setBattleView);

  const onClose = () => {
    togglePopup(entityDetails);
    setClickedHex(undefined);
  };

  return (
    <>
      <HexagonInformationPanel />

      <Button onClick={() => setBattleView(true)}>battle</Button>
    </>
  );
};
