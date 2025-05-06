import { SettlementLocation } from "@/ui/components/settlement/settlement-types";
import { ModalContainer } from "../modal-container";
import { SettlementMinimap } from "./settlement-minimap";

interface SettlementMinimapModalProps {
  onSelectLocation: (location: SettlementLocation) => void;
  onConfirm: () => void;
  maxLayers: number;
  realmId: number;
  realmName: string;
  extraPlayerOccupiedLocations?: SettlementLocation[];
}

export const SettlementMinimapModal = ({
  onSelectLocation,
  onConfirm,
  maxLayers,
  realmId,
  realmName,
  extraPlayerOccupiedLocations = [],
}: SettlementMinimapModalProps) => {
  return (
    <ModalContainer size="auto" title={`Select Location for Realm #${realmId} - ${realmName}`}>
      <SettlementMinimap
        onSelectLocation={onSelectLocation}
        onConfirm={onConfirm}
        maxLayers={maxLayers}
        extraPlayerOccupiedLocations={extraPlayerOccupiedLocations}
      />
    </ModalContainer>
  );
};
