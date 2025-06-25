import { ModalContainer } from "@/ui/shared";
import { AutomationTransferTable } from "./automation-transfer-table";

export const TransferModal = () => {
  return (
    <ModalContainer size="full">
      <AutomationTransferTable />
    </ModalContainer>
  );
};
