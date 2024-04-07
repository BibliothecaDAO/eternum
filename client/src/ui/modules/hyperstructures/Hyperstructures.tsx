import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { HyperstructuresPanel } from "../../components/worldmap/hyperstructures/HyperstructuresPanel";
import { hyperstructures } from "../../components/navigation/Config";

export const HyperStructures = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(hyperstructures));

  return (
    <OSWindow onClick={() => togglePopup(hyperstructures)} show={isOpen} title={hyperstructures}>
      {/* COMPONENTS GO HERE */}
      <HyperstructuresPanel minimumRealmLevel={5} />
    </OSWindow>
  );
};
