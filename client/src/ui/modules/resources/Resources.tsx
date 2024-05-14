import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { resources } from "@/ui/components/navigation/Config";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";

export const Resources = ({ entityId }: { entityId: bigint | undefined }) => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(resources));

  return (
    <OSWindow width="250px" onClick={() => togglePopup(resources)} show={isOpen} title={resources}>
      <EntityResourceTable entityId={entityId} />
    </OSWindow>
  );
};
