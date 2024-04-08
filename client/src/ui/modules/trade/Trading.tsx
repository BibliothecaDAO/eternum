import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { trade } from "@/ui/components/navigation/Config";

export const Trading = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(trade));

  return (
    <OSWindow width="600px" onClick={() => togglePopup(trade)} show={isOpen} title={trade}>
      {/* COMPONENTS GO HERE */}
      trading
    </OSWindow>
  );
};
