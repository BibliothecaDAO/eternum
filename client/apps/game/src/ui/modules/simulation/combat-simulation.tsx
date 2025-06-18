import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { battleSimulation } from "@/ui/features/world/components/config";
import { OSWindow } from "@/ui/features/world/components/os-window";
import { CombatSimulationPanel } from "@/ui/features/world/components/battles/combat-simulation-panel";

export const CombatSimulation = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(battleSimulation));

  return (
    <OSWindow
      onClick={() => togglePopup(battleSimulation)}
      show={isOpen}
      title={"Combat simulation"}
      hintSection={HintSection.Combat}
      width="800px"
    >
      <CombatSimulationPanel />
    </OSWindow>
  );
};
