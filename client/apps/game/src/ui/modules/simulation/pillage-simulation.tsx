import useUIStore from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/HintModal";
import { PillageSimulationPanel } from "@/ui/components/worldmap/battles/PillageSimulationPanel";
import { pillageSimulation } from "../../components/navigation/Config";
import { OSWindow } from "../../components/navigation/OSWindow";

export const PillageSimulation = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(pillageSimulation));

  return (
    <OSWindow
      onClick={() => togglePopup(pillageSimulation)}
      show={isOpen}
      title={"Pillage simulation"}
      hintSection={HintSection.Combat}
      width="600px"
    >
      <PillageSimulationPanel />
    </OSWindow>
  );
};
