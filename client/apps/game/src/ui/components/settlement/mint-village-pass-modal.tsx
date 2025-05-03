import Button from "@/ui/elements/button";

import { fetchRealmVillageSlots, RealmVillageSlot } from "@/services/api";
import { useDojo } from "@bibliothecadao/react";
import { Direction, HexPosition } from "@bibliothecadao/types";
import { ControllerConnector } from "@cartridge/connector";
import { useAccount } from "@starknet-react/core";
import { useEffect, useMemo, useState } from "react";
import { ModalContainer } from "../modal-container";
import { SettlementMinimap } from "./settlement-minimap";
import { VillageResourceReveal } from "./village-resource-reveal";

interface MintVillagePassModalProps {
  onClose: () => void;
}

const villagePassAddr = "0x06cb56ff0b739db15ca5ca01742eca20182c94f4d7f684cf123d5af92559a7da";

export const MintVillagePassModal = ({ onClose }: MintVillagePassModalProps) => {
  const {
    setup: {
      account: { account },
      components,
      systemCalls: { create_village },
    },
  } = useDojo();
  const { address, connector } = useAccount();

  const controllerConnector = connector as never as ControllerConnector;
  const [starterPacks, setStarterPacks] = useState(0);
  const mintStarterPack = async (id: string) => {
    controllerConnector.controller.openStarterPack(id);
  };

  setInterval(() => {
    if (!address) return;

    controllerConnector.controller.account
      ?.callContract({
        contractAddress: villagePassAddr,
        entrypoint: "balanceOf",
        calldata: [address],
      })
      .then((res) => {
        setStarterPacks(parseInt(res[0]));
      });
  }, 20000);

  console.log({ starterPacks });

  const [availableVillages, setAvailableVillages] = useState<RealmVillageSlot[]>([]);
  const [selectedRealm, setSelectedRealm] = useState<RealmVillageSlot | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<HexPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResourceReveal, setShowResourceReveal] = useState(false);

  // New state variables
  const [directionOptions, setDirectionOptions] = useState<
    Array<{
      value: Direction;
      label: string;
      // Note: coord is not used in current logic, removed for now
    }>
  >([]);

  const handleSettleVillage = async () => {
    if (selectedRealm !== null && selectedDirection !== null) {
      create_village({
        village_pass_token_id: 0,
        connected_realm: selectedRealm.connected_realm_entity_id,
        direction: selectedDirection,
        signer: account,
      });
      setShowResourceReveal(true);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setAvailableVillages(await fetchRealmVillageSlots());
    };
    fetchData();
  }, [address]);

  useMemo(() => {
    const selectedLocation = availableVillages.find(
      (village) =>
        village.connected_realm_coord.col === selectedCoords?.col &&
        village.connected_realm_coord.row === selectedCoords?.row,
    );

    if (!selectedLocation) {
      setSelectedRealm(null);
      return null;
    }

    setSelectedRealm(selectedLocation);
  }, [availableVillages, selectedCoords]);

  // Update direction options when selectedRealm changes
  useEffect(() => {
    if (selectedRealm && selectedRealm.directions_left) {
      const options = selectedRealm.directions_left
        .map((dirObj) => {
          const [directionName, slotArray] = Object.entries(dirObj)[0];
          if (slotArray.length === 0) {
            return getDirectionInfo(directionName);
          }
          return null;
        })
        .filter((option): option is { value: Direction; label: string } => option !== null);

      setDirectionOptions(options);
      setSelectedDirection(null); // Reset selected direction when realm changes
    } else {
      setDirectionOptions([]); // Clear options if no realm is selected or directions are missing
      setSelectedDirection(null);
    }
  }, [selectedRealm]);

  return (
    <ModalContainer size="medium" title="">
      <div className="h-full flex flex-col px-8">
        <div className="flex-1 overflow-auto space-y-6">
          <div className=" rounded-md mb-8">
            <h2 className="mb-4">About Villages</h2>
            <p className="text-xl text-gray-300 mb-2">
              Villages are smaller settlements with fewer perks than Realms. Each Realm has 6 possible village spots
              (one in each direction).
            </p>
            <Button variant="gold" onClick={() => mintStarterPack("eternum-village-pass")}>
              Purchase Village Pass $10
            </Button>
          </div>

          {!showResourceReveal ? (
            <div className="flex space-x-8">
              {/* Left Column: Selectors and Buttons */}
              <div className="flex-1">
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gold h6">Select Realm</label>
                  </div>

                  <select
                    value={selectedRealm?.connected_realm_entity_id ?? ""}
                    onChange={(e) => {
                      const entityId = Number(e.target.value);
                      const village = availableVillages.find((v) => v.connected_realm_entity_id === entityId);
                      if (village) {
                        setSelectedRealm(village);
                        setSelectedCoords(village.connected_realm_coord);
                      } else {
                        setSelectedRealm(null);
                        setSelectedCoords(null);
                      }
                    }}
                    className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                    style={{ backgroundPosition: "right 0.75rem center" }}
                    disabled={isLoading || availableVillages.length === 0} // Disable if loading or no villages
                  >
                    <option value="" disabled>
                      {availableVillages.length > 0 ? "Select a Realm" : "Loading available Realms..."}
                    </option>
                    {availableVillages.map((village) => (
                      <option key={village.connected_realm_entity_id} value={village.connected_realm_entity_id}>
                        {`Realm #${village.connected_realm_id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRealm && (
                  <div className="flex justify-between items-center my-3 border border-gold/30 rounded-md p-2">
                    <h4 className="text-gold h6">Realm: {selectedRealm.connected_realm_entity_id}</h4>

                    <div className="text-gold h6">
                      <div className="w-full space-y-2">
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
                              {(() => {
                                switch (option.label) {
                                  case "North East":
                                    return "↗";
                                  case "East":
                                    return "→";
                                  case "South East":
                                    return "↘";
                                  case "South West":
                                    return "↙";
                                  case "West":
                                    return "←";
                                  case "North West":
                                    return "↖";
                                  default:
                                    return "";
                                }
                              })()}
                              {` ${option.label}`}
                            </option>
                          ))}
                        </select>
                        {selectedRealm && directionOptions.length === 0 && (
                          <div className="text-xs text-red-400 mt-1">
                            No available spots for this realm. This can happen if mines or hyperstructures are
                            discovered on the village spots.
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedRealm(null);
                        setSelectedDirection(null);
                        setSelectedCoords(null);
                      }}
                    >
                      Reset Selection
                    </Button>
                  </div>
                )}

                {!selectedRealm && (
                  <div className="py-2">
                    <SettlementMinimap
                      onSelectLocation={(location) => {
                        setSelectedCoords({
                          col: location.x,
                          row: location.y,
                        });
                      }}
                      onConfirm={() => {}}
                      maxLayers={50}
                      extraPlayerOccupiedLocations={[]}
                      villageSelect={true}
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 justify-center pt-4">
                  <Button onClick={onClose} variant="danger">
                    Cancel
                  </Button>
                  <Button
                    variant="gold"
                    onClick={handleSettleVillage}
                    disabled={!(selectedRealm !== null && selectedDirection !== null)}
                    isLoading={isLoading}
                  >
                    {isLoading ? "Minting..." : "Settle Village"}
                  </Button>
                </div>
              </div>

              {/* <div className="w-96 p-4 bg-dark-brown/50 border border-gold/20 rounded-md h-fit">
                <h3 className="text-gold h6 mb-4 text-center">Village Preview</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gold/70 block">Realm</label>
                    <p className="text-gold">
                      {selectedRealm
                        ? `Realm #${selectedRealm.realmId} - ${getRealmNameById(selectedRealm.realmId) || "Unnamed"}`
                        : "Not Selected"}
                    </p>
                  </div>
                  
                </div>
              </div> */}
            </div>
          ) : (
            selectedCoords && (
              <VillageResourceReveal
                villageCoords={selectedCoords}
                onClose={onClose}
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
      </div>
    </ModalContainer>
  );
};

// Helper function to map direction names to enum values and labels
const getDirectionInfo = (directionName: string): { value: Direction; label: string } | null => {
  switch (directionName) {
    case "NorthEast":
      return { value: Direction.NORTH_EAST, label: "North East" };
    case "East":
      return { value: Direction.EAST, label: "East" };
    case "SouthEast":
      return { value: Direction.SOUTH_EAST, label: "South East" };
    case "SouthWest":
      return { value: Direction.SOUTH_WEST, label: "South West" };
    case "West":
      return { value: Direction.WEST, label: "West" };
    case "NorthWest":
      return { value: Direction.NORTH_WEST, label: "North West" };
    default:
      return null;
  }
};
