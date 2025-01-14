import { HintSection } from "@/ui/components/hints/hint-modal";
import { battleSimulation } from "@/ui/components/navigation/config";
import { OSWindow } from "@/ui/components/navigation/os-window";
import { BattleSimulationPanel } from "@/ui/components/worldmap/battles/battle-simulation-panel";
import { useUIStore } from "@bibliothecadao/react";

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
