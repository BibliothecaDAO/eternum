import { HintSection } from "@/ui/components/hints/HintModal";
import { BattleSimulationPanel } from "@/ui/components/worldmap/battles/BattleSimulationPanel";
import useUIStore from "../../../hooks/store/useUIStore";
import { battleSimulation } from "../../components/navigation/Config";
import { OSWindow } from "../../components/navigation/OSWindow";

export const BattleSimulation = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(battleSimulation));

  return (
    <OSWindow
      onClick={() => togglePopup(battleSimulation)}
      show={isOpen}
      title={"Battle simulation"}
      hintSection={HintSection.Combat}
      width="600px"
    >
      <BattleSimulationPanel />
    </OSWindow>
  );
};
