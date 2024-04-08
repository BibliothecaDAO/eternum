import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { hyperstructures } from "../../components/navigation/Config";
import { HyperStructureList } from "@/ui/components/hyperstructures/HyperstructureList";

export const HyperStructures = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(hyperstructures));

  return (
    <OSWindow width="600px" onClick={() => togglePopup(hyperstructures)} show={isOpen} title={hyperstructures}>
      {/* COMPONENTS GO HERE */}

      <HyperStructureList />
    </OSWindow>
  );
};
