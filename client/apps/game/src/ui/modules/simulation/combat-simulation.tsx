import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/features/progression";
import { battleSimulation, CombatSimulationPanel, OSWindow } from "@/ui/features/world";

export const CombatSimulation = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(battleSimulation));

  return (
    <OSWindow
      onClick={() => togglePopup(battleSimulation)}
      show={isOpen}
      title={"Combat simulation"}
      hintSection={HintSection.Combat}
      width="1000px"
      height="1000px"
    >
      <CombatSimulationPanel />
    </OSWindow>
  );
};
