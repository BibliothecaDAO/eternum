import useUIStore from "../../hooks/store/useUIStore";
import { OSWindow } from "./OSWindow";
import { eventLog } from "./Config";

export const EventLog = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(eventLog));

  return (
    <OSWindow onClick={() => togglePopup(eventLog)} show={isOpen} title={eventLog}>
      {/* COMPONENTS GO HERE */}
      hello
    </OSWindow>
  );
};
