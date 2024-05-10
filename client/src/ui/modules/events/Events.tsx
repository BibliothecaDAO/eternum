import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { eventLog } from "../../components/navigation/Config";

export const EventLog = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(eventLog));

  return (
    <OSWindow onClick={() => togglePopup(eventLog)} show={isOpen} title={eventLog}>
      {/* COMPONENTS GO HERE */}
      hello
    </OSWindow>
  );
};
