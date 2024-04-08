import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { hyperstructures } from "../../components/navigation/Config";
import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructureList";
import { EntityList } from "@/ui/components/list/EntityList";

const exampleHyperstructures = [
  { id: 1, name: "Loaf", location: { x: 1, y: 1 } },
  { id: 2, name: "Rashel", location: { x: 1, y: 1 } },
  { id: 3, name: "Credence", location: { x: 1, y: 1 } },
  { id: 4, name: "1337", location: { x: 1, y: 1 } },
];

export const HyperStructures = () => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(hyperstructures));

  return (
    <OSWindow width="600px" onClick={() => togglePopup(hyperstructures)} show={isOpen} title={hyperstructures}>
      <EntityList
        title="Hyperstructures"
        panel={({ entity }) => <HyperstructurePanel entity={entity} />}
        list={exampleHyperstructures}
      />
    </OSWindow>
  );
};
