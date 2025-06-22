import { SettlementLocation } from "../utils/settlement-types";
import { ModalContainer } from "@/ui/shared";
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
