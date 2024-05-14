import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { construction } from "@/ui/components/navigation/Config";
import { EntityPopulation } from "@/ui/components/entities/EntityPopulation";

export const Construction = ({ entityId }: { entityId: bigint | undefined }) => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(construction));

  return (
    <OSWindow onClick={() => togglePopup(construction)} show={isOpen} title={construction}>
      <EntityPopulation entityId={entityId} />
    </OSWindow>
  );
};
