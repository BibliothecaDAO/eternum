import Button from "@/ui/elements/button";
import { getEntityIdFromKeys, getRealmNameById } from "@bibliothecadao/eternum";

import { useDojo } from "@bibliothecadao/react";
import {
  checkOpenVillageSlotFromToriiClient,
  getRandomRealmWithVillageSlotsFromTorii,
} from "@bibliothecadao/torii-client";
import { Direction, HexPosition, ID, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { ModalContainer } from "../modal-container";
import { VillageResourceReveal } from "./village-resource-reveal";

interface MintVillagePassModalProps {
  onClose: () => void;
}

export const MintVillagePassModal = ({ onClose }: MintVillagePassModalProps) => {
  const {
    network: { toriiClient },
    setup: {
      account: { account },
      components,
      systemCalls: { create_village },
    },
  } = useDojo();

  const [selectedRealm, setSelectedRealm] = useState<{ realmId: ID; entityId: ID } | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<HexPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResourceReveal, setShowResourceReveal] = useState(false);

  // New state variables
  const [realmIdInput, setRealmIdInput] = useState<string>("");
  const [realmCheckResult, setRealmCheckResult] = useState<{
    realmId: ID;
    entityId: ID;
    hasSlots: boolean;
    availableSlots: Array<{
      value: Direction;
      label: string;
      coord: { col: number; row: number };
    }>;
    position: HexPosition;
  } | null>(null);
  const [isCheckingRealm, setIsCheckingRealm] = useState(false);
  const [realmCheckError, setRealmCheckError] = useState<string | null>(null);
  const [directionOptions, setDirectionOptions] = useState<
    Array<{
      value: Direction;
      label: string;
      coord: { col: number; row: number };
    }>
  >([]);

  const handleSettleVillage = async () => {
    if (selectedRealm !== null && selectedDirection !== null) {
      create_village({
        connected_realm: selectedRealm.entityId,
        direction: selectedDirection,
        signer: account,
      });
      setShowResourceReveal(true);
    }
  };

  // Function to check a specific realm for village slots
  const checkRealm = async () => {
    if (!realmIdInput.trim()) {
      setRealmCheckError("Please enter a realm ID");
      return;
    }

    const realmId = Number(realmIdInput);
    if (isNaN(realmId)) {
      setRealmCheckError("Please enter a valid realm ID (number)");
      return;
    }

    setIsCheckingRealm(true);
    setRealmCheckError(null);

    try {
      const result = await checkOpenVillageSlotFromToriiClient(toriiClient, realmId);

      if (!result) {
        setRealmCheckError("Realm has no available village slots");
        setRealmCheckResult(null);
        setSelectedRealm(null);
      } else {
        setRealmCheckResult(result);
        setSelectedRealm({
          realmId: result.realmId,
          entityId: result.entityId,
        });
        setRealmCheckError(null);
      }
    } catch (error) {
      console.error("Error checking realm:", error);
      setRealmCheckError("Error checking realm. Please try again.");
    } finally {
      setIsCheckingRealm(false);
    }
  };

  // Function to select a random realm with village slots
  const selectRandomRealm = async () => {
    setIsLoading(true);
    const realmCount =
      getComponentValue(components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.realm_count_config.count || 0;
    try {
      const data = await getRandomRealmWithVillageSlotsFromTorii(toriiClient);
      if (data && data) {
        // Extract values safely with type assertions
        const result = {
          realmId: data.realmId,
          entityId: data.entityId,
          hasSlots: true,
          availableSlots: data.availableSlots,
          position: { col: data.position.col, row: data.position.row },
        };

        console.log({ result });
        setRealmCheckResult(result);

        setSelectedRealm({
          realmId: result.realmId,
          entityId: result.entityId,
        });

        setRealmIdInput(data.realmId.toString());
        setRealmCheckError(null);
      } else {
        setRealmCheckError("No realms with available village slots found");
      }
    } catch (error) {
      console.error("Error selecting random realm:", error);
      setRealmCheckError("Error selecting random realm. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to select the checked realm
  // const selectCheckedRealm = () => {
  //   if (realmCheckResult && realmCheckResult.hasSlots) {
  //     setSelectedRealm({
  //       realmId: realmCheckResult.realmId,
  //       entityId: realmCheckResult.entityId,
  //     });
  //   }
  // };

  useEffect(() => {
    const loadDirectionOptions = async () => {
      if (!selectedRealm || !realmCheckResult) {
        setDirectionOptions([]);
        return;
      }

      try {
        const options = realmCheckResult?.availableSlots;
        setDirectionOptions(options);

        // Auto-select the first direction if available
        if (options.length > 0) {
          setSelectedDirection(options[0].value);
        }
      } catch (error) {
        console.error("Error loading direction options:", error);
        setDirectionOptions([]);
      }
    };

    loadDirectionOptions();
  }, [selectedRealm, toriiClient]);

  useEffect(() => {
    if (selectedDirection !== null) {
      const coord = directionOptions.find((option) => option.value === selectedDirection)?.coord;
      setSelectedCoords(coord ? coord : null);
    } else {
      setSelectedCoords(null);
    }
  }, [selectedDirection, directionOptions]);

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
          </div>

          {!showResourceReveal ? (
            <div className="flex space-x-8">
              {/* Left Column: Selectors and Buttons */}
              <div className="flex-1 space-y-8">
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gold h6">Select Realm</label>
                    <Button
                      onClick={selectRandomRealm}
                      className="text-xs bg-dark-brown border border-gold/30 text-gold px-2 py-1 rounded-md hover:bg-gold/20"
                      disabled={isLoading}
                    >
                      {isLoading ? "Loading..." : "Random Realm"}
                    </Button>
                  </div>

                  {/* Realm ID Input */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={realmIdInput}
                      onChange={(e) => setRealmIdInput(e.target.value)}
                      placeholder="Enter Realm ID"
                      className="flex-1 p-2 bg-dark-brown border border-gold/30 rounded-md text-gold focus:outline-none focus:ring-0 focus:border-gold"
                    />
                    <Button
                      onClick={checkRealm}
                      className="bg-dark-brown border border-gold/30 text-gold px-4 py-2 rounded-md hover:bg-gold/20"
                      disabled={isCheckingRealm}
                    >
                      {isCheckingRealm ? "Checking..." : "Check"}
                    </Button>
                  </div>

                  {/* Realm Check Result */}
                  {realmCheckResult && (
                    <div className={`p-3 rounded-md "bg-green-900/30 border border-green-500/30"`}>
                      <p className="text-gold">
                        Realm #{realmCheckResult.realmId} - {getRealmNameById(realmCheckResult.realmId) || "Unnamed"}
                      </p>
                      <p className="text-sm text-gold/80">
                        {`${realmCheckResult.availableSlots.length} village slot${realmCheckResult.availableSlots.length !== 1 ? "s" : ""} available`}
                      </p>
                      {/* {realmCheckResult.hasSlots && (
                        <Button
                          onClick={selectCheckedRealm}
                          className="mt-2 text-xs bg-dark-brown border border-gold/30 text-gold px-2 py-1 rounded-md hover:bg-gold/20"
                        >
                          Select This Realm
                        </Button>
                      )} */}
                    </div>
                  )}

                  {/* Error Message */}
                  {realmCheckError && <div className="text-xs text-red-400 mt-1">{realmCheckError}</div>}
                </div>

                {/* <div className="w-full space-y-2">
                  <label className="text-gold h6">Select Direction</label>
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
                    <div className="text-xs text-red-400 mt-1">
                      No available spots for this realm. This can happen if mines or hyperstructures are discovered on
                      the village spots.
                    </div>
                  )}
                </div> */}

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

              {/* Right Column: Preview */}
              <div className="w-96 p-4 bg-dark-brown/50 border border-gold/20 rounded-md h-fit">
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
                  {/* <div>
                    <label className="text-xs text-gold/70 block">Direction</label>
                    <p className="text-gold">
                      {selectedDirection !== null
                        ? (directionOptions.find((o) => o.value === selectedDirection)?.label ?? "Unknown")
                        : "Not Selected"}
                    </p>
                  </div> */}
                  {/* Add more preview details if needed */}
                </div>
              </div>
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
