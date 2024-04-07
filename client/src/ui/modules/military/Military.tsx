import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { military } from "@/ui/components/navigation/Config";

export const Military = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(military));

  return (
    <OSWindow onClick={() => togglePopup(military)} show={isOpen} title={military}>
      {/* COMPONENTS GO HERE */}
      military
    </OSWindow>
  );
};
