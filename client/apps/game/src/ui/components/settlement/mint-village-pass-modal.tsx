import Button from "@/ui/elements/button";
import { getFreeVillagePositions, getRealmNameById, HexDirection } from "@bibliothecadao/eternum";
import { useDojo, useRealms } from "@bibliothecadao/react";
import { useMemo, useState } from "react";
import { ModalContainer } from "../modal-container";
import SettlementMinimap from "./settlement-minimap";
import { SettlementLocation } from "./settlement-types";

interface MintVillagePassModalProps {
  onClose: () => void;
}

export const MintVillagePassModal = ({ onClose }: MintVillagePassModalProps) => {
  const {
    setup: { components },
  } = useDojo();
  const realms = useRealms();
  const [selectedRealm, setSelectedRealm] = useState<number | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<HexDirection | null>(HexDirection.NorthEast);
  const [showMinimap, setShowMinimap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SettlementLocation | null>(null);

  const handleSelectLocation = (location: SettlementLocation) => {
    setSelectedLocation(location);
  };

  const handleConfirmLocation = () => {
    setShowMinimap(false);
  };

  const handleSettleVillage = () => {
    if ((selectedRealm !== null && selectedDirection !== null) || selectedLocation !== null) {
      if (selectedLocation) {
        console.log(
          `Settling village at location: Layer ${selectedLocation.layer}, Side ${selectedLocation.side}, Point ${selectedLocation.point}`,
        );
      } else {
        console.log(`Settling village in realm ${selectedRealm} towards ${HexDirection[selectedDirection!]}`);
      }
      onClose();
    } else {
      console.log("Please select a realm and a direction or choose a location on the map.");
    }
  };

  const selectRandomRealm = () => {
    if (realms.length > 0) {
      const randomIndex = Math.floor(Math.random() * realms.length);
      setSelectedRealm(randomIndex);
    }
  };

  const directionOptions = useMemo(() => {
    if (!selectedRealm) return [];

    const freePositions = getFreeVillagePositions(selectedRealm, components);

    return Object.keys(HexDirection)
      .filter((key) => isNaN(Number(key)))
      .filter((dir) => {
        const direction = HexDirection[dir as keyof typeof HexDirection];
        return freePositions.some((pos) => pos.direction === direction);
      })
      .map((dir) => ({
        value: HexDirection[dir as keyof typeof HexDirection],
        label: dir.replace(/([A-Z])/g, " $1").trim(),
      }));
  }, [selectedRealm, components]);

  if (showMinimap) {
    return (
      <SettlementMinimap
        onSelectLocation={handleSelectLocation}
        onConfirm={handleConfirmLocation}
        maxLayers={3}
        extraPlayerOccupiedLocations={[]}
      />
    );
  }

  return (
    <ModalContainer size="medium" title="Mint Village Pass">
      <div className="h-full flex flex-col p-4 space-y-6">
        <div className="flex-1 overflow-auto space-y-6">
          <div className="bg-dark-brown/70 border border-gold/30 rounded-md p-4 mb-4">
            <h3 className="text-gold font-semibold mb-2">About Villages</h3>
            <p className="text-sm text-gray-300 mb-2">
              Villages are smaller settlements with fewer perks than Realms. Each Realm has 6 possible village spots
              (one in each direction).
            </p>
            <div className="flex items-center mt-2 bg-black/30 p-2 rounded border border-gold/20">
              <div className="text-gold mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-xs text-gold/80">
                Select a Realm you own and choose one of the six directions to place your village.
              </p>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-gold font-semibold">Select Realm</label>
                <Button
                  onClick={selectRandomRealm}
                  className="text-xs bg-dark-brown border border-gold/30 text-gold px-2 py-1 rounded-md hover:bg-gold/20"
                >
                  Random Realm
                </Button>
              </div>
              <select
                onChange={(e) => setSelectedRealm(Number(e.target.value))}
                value={selectedRealm ?? ""}
                className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                style={{ backgroundPosition: "right 0.75rem center" }}
              >
                <option value="" disabled>
                  Select a Realm
                </option>
                {realms.map((realm, index) => (
                  <option key={index} value={index}>
                    {`Realm #${realm.entity_id} - ${getRealmNameById(realm.metadata.realm_id) || "Unnamed"}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full space-y-2">
              <label className="text-gold font-semibold">Select Direction</label>
              <select
                onChange={(e) => setSelectedDirection(e.target.value as unknown as HexDirection)}
                value={selectedDirection ?? ""}
                className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                style={{ backgroundPosition: "right 0.75rem center" }}
              >
                <option value="" disabled>
                  Select a Direction
                </option>
                {directionOptions.map((option, index) => (
                  <option key={index} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* <div className="flex justify-center">
            <span className="text-sm text-gray-400">- or -</span>
          </div> */}

          {/* <Button
            onClick={() => setShowMinimap(true)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md"
          >
            Choose Location on Map
          </Button> */}

          {selectedLocation && (
            <div className="mt-4 p-3 bg-gray-800 rounded-md border border-gray-700">
              <h3 className="text-sm font-medium text-gray-200 mb-1">Selected Location:</h3>
              <p className="text-xs text-gray-400">
                Layer: {selectedLocation.layer}, Side: {selectedLocation.side}, Point: {selectedLocation.point}
              </p>
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSettleVillage}
            className="flex-1"
            isPulsing={(selectedRealm !== null && selectedDirection !== null) || selectedLocation !== null}
            disabled={!((selectedRealm !== null && selectedDirection !== null) || selectedLocation !== null)}
          >
            Mint Village Pass
          </Button>
        </div>
      </div>
    </ModalContainer>
  );
};

export default MintVillagePassModal;
