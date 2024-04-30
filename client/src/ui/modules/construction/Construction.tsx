import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { construction } from "@/ui/components/navigation/Config";

import { SelectPreviewBuilding } from "@/ui/components/construction/SelectPreviewBuilding";
import { EntityPopulation } from "@/ui/components/entities/EntityPopulation";
import { useDojo } from "@/hooks/context/DojoContext";
import Button from "@/ui/elements/Button";
export const Construction = ({ entityId }: { entityId: bigint | undefined }) => {
  const { togglePopup } = useUIStore();

  const isOpen = useUIStore((state) => state.isPopupOpen(construction));

  const {
    setup: {
      systemCalls: { mint_starting_resources },
    },
    account: { account },
  } = useDojo();

  return (
    <OSWindow onClick={() => togglePopup(construction)} show={isOpen} title={construction}>
      <Button onClick={() => mint_starting_resources({ signer: account, realm_entity_id: entityId || "0" })}>
        mint starting
      </Button>
      <EntityPopulation entityId={entityId} />
      <SelectPreviewBuilding />
    </OSWindow>
  );
};
