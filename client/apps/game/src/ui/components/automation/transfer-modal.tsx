import { ModalContainer } from "../modal-container";
import { AutomationTransferTable } from "./automation-transfer-table";

export const TransferModal = () => {
  return (
    <ModalContainer size="full">
      <AutomationTransferTable />
    </ModalContainer>
  );
};
