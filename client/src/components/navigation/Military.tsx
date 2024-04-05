import useUIStore from "../../hooks/store/useUIStore";
import { OSWindow } from "./OSWindow";
import { military } from "./Config";

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
