import Button from "@/ui/elements/button";
import { Direction, getFreeVillagePositions, getRealmNameById, HexPosition, ID } from "@bibliothecadao/eternum";
import { useDojo, useRealms } from "@bibliothecadao/react";
import { useEffect, useMemo, useState } from "react";
import { ModalContainer } from "../modal-container";
import { VillageResourceReveal } from "./village-resource-reveal";

interface MintVillagePassModalProps {
  onClose: () => void;
}

export const MintVillagePassModal = ({ onClose }: MintVillagePassModalProps) => {
  const {
    setup: {
      account: { account },
      components,
      systemCalls: { create_village },
    },
  } = useDojo();
  const realms = useRealms();

  const realmsWithVillageSlots = useMemo(() => {
    return realms.filter((realm) => realm.metadata.villages_count <= 5);
  }, [realms]);

  const [selectedRealm, setSelectedRealm] = useState<{ realmId: ID; entityId: ID } | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<HexPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResourceReveal, setShowResourceReveal] = useState(false);

  const handleSettleVillage = async () => {
    if (selectedRealm !== null && selectedDirection !== null) {
      setIsLoading(true);
      await create_village({
        connected_realm: selectedRealm.entityId,
        direction: selectedDirection,
        signer: account,
      })
        .then(() => setShowResourceReveal(true))
        .finally(() => setIsLoading(false));
    }
    // onClose();
  };

  const selectRandomRealm = () => {
    if (realmsWithVillageSlots.length > 0) {
      const randomIndex = Math.floor(Math.random() * realmsWithVillageSlots.length);
      setSelectedRealm({
        realmId: realmsWithVillageSlots[randomIndex].metadata.realm_id,
        entityId: realmsWithVillageSlots[randomIndex].entity_id,
      });
      setSelectedDirection(null);
      setSelectedCoords(null);
    }
  };

  const directionOptions = useMemo(() => {
    if (!selectedRealm) return [];

    const freePositions = getFreeVillagePositions(selectedRealm.entityId, components);

    return Object.keys(Direction)
      .filter((key) => isNaN(Number(key)))
      .filter((dir) => {
        const direction = Direction[dir as keyof typeof Direction];
        return freePositions.some((pos) => pos.direction === direction);
      })
      .map((dir) => {
        const direction = Direction[dir as keyof typeof Direction];
        const position = freePositions.find((pos) => pos.direction === direction);
        return {
          value: direction,
          label: dir.replace(/_/g, " "),
          coord: { col: position?.col ?? 0, row: position?.row ?? 0 },
        };
      });
  }, [selectedRealm, components]);

  useEffect(() => {
    if (selectedDirection) {
      const coord = directionOptions.find((option) => option.value === selectedDirection)?.coord;
      setSelectedCoords(coord ? coord : null);
    } else {
      setSelectedCoords(null);
    }
  }, [selectedDirection, directionOptions]);

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
                  disabled={realmsWithVillageSlots.length === 0}
                >
                  Random Realm
                </Button>
              </div>
              <select
                onChange={(e) =>
                  setSelectedRealm({
                    realmId: Number(e.target.value),
                    entityId:
                      realmsWithVillageSlots.find((realm) => realm.metadata.realm_id === Number(e.target.value))
                        ?.entity_id || 0,
                  })
                }
                value={selectedRealm?.realmId ?? ""}
                className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                style={{ backgroundPosition: "right 0.75rem center" }}
              >
                <option value="" disabled>
                  Select a Realm {realmsWithVillageSlots.length === 0 && "(No available slots)"}
                </option>
                {realmsWithVillageSlots.map((realm, index) => {
                  const availableSlots = 6 - realm.metadata.villages_count;
                  return (
                    <option key={index} value={realm.metadata.realm_id}>
                      {`Realm #${realm.metadata.realm_id} - ${getRealmNameById(realm.metadata.realm_id) || "Unnamed"} (${availableSlots} slot${availableSlots !== 1 ? "s" : ""} available)`}
                    </option>
                  );
                })}
              </select>
              {selectedRealm && (
                <div className="text-xs text-gold/60 mt-1">
                  {`${6 - (realmsWithVillageSlots.find((r) => r.metadata.realm_id === selectedRealm.realmId)?.metadata.villages_count || 0)} village slots remaining`}
                </div>
              )}
            </div>

            <div className="w-full space-y-2">
              <label className="text-gold font-semibold">Select Direction</label>
              <select
                onChange={(e) => setSelectedDirection(Number(e.target.value) as Direction)}
                value={selectedDirection ?? ""}
                className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                style={{ backgroundPosition: "right 0.75rem center" }}
                disabled={!selectedRealm}
              >
                <option value="" disabled>
                  {selectedRealm ? "Select a Direction" : "First select a Realm"}
                </option>
                {directionOptions.map((option, index) => (
                  <option key={index} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedRealm && directionOptions.length === 0 && (
                <div className="text-xs text-red-400 mt-1">No available directions for this Realm</div>
              )}
            </div>
          </div>
        </div>

        {!showResourceReveal ? (
          <div className="flex space-x-3">
            <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSettleVillage}
              className="flex-1"
              isPulsing={selectedRealm !== null && selectedDirection !== null}
              disabled={!(selectedRealm !== null && selectedDirection !== null)}
              isLoading={isLoading}
            >
              Mint Village Pass
            </Button>
          </div>
        ) : (
          selectedCoords && (
            <VillageResourceReveal
              villageCoords={selectedCoords}
              onClose={() => setShowResourceReveal(false)}
              onRestart={() => {
                setShowResourceReveal(false);
                setSelectedCoords(null);
                setSelectedDirection(null);
                setSelectedRealm(null);
              }}
            />
          )
        )}
      </div>
    </ModalContainer>
  );
};

export default MintVillagePassModal;
