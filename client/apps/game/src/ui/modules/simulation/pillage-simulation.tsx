import { HintSection } from "@/ui/components/hints/hint-modal";
import { pillageSimulation } from "@/ui/components/navigation/config";
import { OSWindow } from "@/ui/components/navigation/os-window";
import { PillageSimulationPanel } from "@/ui/components/worldmap/battles/pillage-simulation-panel";
import { useUIStore } from "@bibliothecadao/react";

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
