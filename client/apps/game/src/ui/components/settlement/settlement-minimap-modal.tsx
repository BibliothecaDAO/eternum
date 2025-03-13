import { SettlementLocation } from "@/utils/settlement";
import { ModalContainer } from "../modal-container";
import SettlementMinimap from "./settlement-minimap";

interface SettlementMinimapModalProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
  realmId: number;
  realmName: string;
}

export const SettlementMinimapModal = ({
  onSelectLocation,
  onConfirm,
  maxLayers,
  realmId,
  realmName,
}: SettlementMinimapModalProps) => {
  return (
    <ModalContainer size="auto" title={`Select Location for Realm #${realmId} - ${realmName}`}>
      <div className="h-full flex flex-col h-full">
        <div className="flex-1 overflow-auto h-full">
          <SettlementMinimap onSelectLocation={onSelectLocation} onConfirm={onConfirm} maxLayers={maxLayers} />
        </div>
      </div>
    </ModalContainer>
  );
};

export default SettlementMinimapModal;
