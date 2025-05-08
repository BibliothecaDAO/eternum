import { fetchRealmVillageSlots, fetchTokenTransfers, RealmVillageSlot, TokenTransfer } from "@/services/api";
import Button from "@/ui/elements/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { useDojo } from "@bibliothecadao/react";
import { Direction, getNeighborHexes, HexPosition, Steps } from "@bibliothecadao/types";
import { ControllerConnector } from "@cartridge/connector";
import { useAccount } from "@starknet-react/core";
import { useEffect, useMemo, useState } from "react";
import { ModalContainer } from "../modal-container";
import { SettlementMinimap } from "./settlement-minimap";
import { VillageResourceReveal } from "./village-resource-reveal";

import { cn } from "@/ui/elements/lib/utils";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getVillagePassAddress } from "@/utils/addresses";
import RealmJson from "../../../../../../public/jsons/realms.json";

interface RealmAttribute {
  trait_type: string;
  value: string | number;
}

interface Realm {
  name: string;
  description: string;
  image: string;
  attributes: RealmAttribute[];
}

interface MintVillagePassModalProps {
  onClose: () => void;
}

// Define the structure for resource probabilities based on the image
interface ResourceProbability {
  name: string;
  chance: number;
}

interface RarityTier {
  name: string;
  totalChance: number;
  resources: ResourceProbability[];
  color: string; // Tailwind color classes for background/border
}

const resourceProbabilities: RarityTier[] = [
  {
    name: "Common",
    totalChance: 50.43,
    color: "bg-gray-600 border-gray-400",
    resources: [
      { name: "Wood", chance: 19.815 },
      { name: "Stone", chance: 15.556 },
      { name: "Coal", chance: 15.062 },
    ],
  },
  {
    name: "Uncommon",
    totalChance: 39.259,
    color: "bg-green-800 border-green-600",
    resources: [
      { name: "Copper", chance: 10.556 },
      { name: "Obsidian", chance: 8.951 },
      { name: "Silver", chance: 7.13 },
      { name: "Ironwood", chance: 5.031 },
      { name: "Cold Iron", chance: 3.92 },
      { name: "Gold", chance: 3.673 },
    ],
  },
  {
    name: "Rare",
    totalChance: 5.802,
    color: "bg-blue-800 border-blue-600",
    resources: [
      { name: "Hartwood", chance: 2.531 },
      { name: "Diamonds", chance: 1.358 },
      { name: "Sapphire", chance: 0.926 },
      { name: "Ruby", chance: 0.988 },
    ],
  },
  {
    name: "Epic",
    totalChance: 2.5,
    color: "bg-purple-800 border-purple-600",
    resources: [
      { name: "Deep Crystal", chance: 1.049 },
      { name: "Ignium", chance: 0.71 },
      { name: "Ethereal Silica", chance: 0.741 },
    ],
  },
  {
    name: "Legendary",
    totalChance: 1.451,
    color: "bg-indigo-800 border-indigo-600",
    resources: [
      { name: "True Ice", chance: 0.556 },
      { name: "Twilight Quartz", chance: 0.494 },
      { name: "Alchemical Silver", chance: 0.401 },
    ],
  },
  {
    name: "Mythic",
    totalChance: 0.556,
    color: "bg-orange-800 border-orange-600",
    resources: [
      { name: "Adamantine", chance: 0.278 },
      { name: "Mithral", chance: 0.185 },
      { name: "Dragonhide", chance: 0.093 },
    ],
  },
];

export const MintVillagePassModal = ({ onClose }: MintVillagePassModalProps) => {
  const {
    setup: {
      account: { account },
      systemCalls: { create_village },
    },
  } = useDojo();
  const { address, connector } = useAccount();

  const controllerConnector = connector as never as ControllerConnector;

  const [villageCoords, setVillageCoords] = useState<HexPosition | null>(null);
  const [realmCoords, setRealmCoords] = useState<HexPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResourceReveal, setShowResourceReveal] = useState(false);
  const [realmSearchTerm, setRealmSearchTerm] = useState("");
  const [selectedResourceFilter, setSelectedResourceFilter] = useState<string | null>(null);
  const [isPurchasingPass, setIsPurchasingPass] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [availableVillages, setAvailableVillages] = useState<RealmVillageSlot[]>([]);
  const [selectedRealm, setSelectedRealm] = useState<RealmVillageSlot | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [purchasedVillagePass, setPurchasedVillagePass] = useState<TokenTransfer[]>([]);
  const [selectedVillagePass, setSelectedVillagePass] = useState<TokenTransfer | null>(null);

  const [directionOptions, setDirectionOptions] = useState<
    Array<{
      value: Direction;
      label: string;
    }>
  >([]);

  const topTiers = resourceProbabilities.slice(0, 3);
  const bottomTiers = resourceProbabilities.slice(3);

  useEffect(() => {
    if (realmCoords && selectedDirection !== null) {
      setVillageCoords(
        getNeighborHexes(realmCoords.col, realmCoords.row, Steps.Two).filter(
          (hex) => hex.direction === selectedDirection,
        )[0],
      );
    }
  }, [realmCoords, selectedDirection]);

  const getRealm = (realmId: number): Realm | undefined => {
    const key = realmId.toString(); // convert number id to string key
    return (RealmJson as Record<string, Realm>)[key];
  };

  const getResources = (realmId: number): string[] => {
    const realmData = getRealm(realmId);
    if (!realmData || !realmData.attributes) {
      return [];
    }
    return realmData.attributes.filter((attr) => attr.trait_type === "Resource").map((attr) => String(attr.value));
  };

  const getRealmName = (realmId: number): string => {
    const realmData = getRealm(realmId);
    if (!realmData || !realmData.attributes) {
      return "";
    }
    return realmData.name;
  };

  const refetchAndSetPasses = async (): Promise<number> => {
    if (address) {
      try {
        const tokenTransfers = await fetchTokenTransfers(getVillagePassAddress(), "0x" + BigInt(address).toString(16));
        const updatedPasses = tokenTransfers.map((a) => {
          return {
            ...a,
            token_id: parseInt(a.token_id.replace(getVillagePassAddress() + ":", "")).toString(),
          };
        });
        setPurchasedVillagePass(updatedPasses);
        return updatedPasses.length;
      } catch (error) {
        console.error("Error fetching token transfers:", error);
      }
    }
    return purchasedVillagePass.length;
  };

  const mintStarterPack = async (id: string) => {
    setIsPurchasingPass(true);
    const initialPassCount = purchasedVillagePass.length;

    try {
      controllerConnector.controller.openStarterPack(id);

      const startTime = Date.now();

      const pollForNewPass = async () => {
        const currentTime = Date.now();
        if (currentTime - startTime > 60000) {
          console.warn("Polling for village pass timed out after 60 seconds.");
          setIsPurchasingPass(false);
          return;
        }

        const updatedPassCount = await refetchAndSetPasses();

        if (updatedPassCount > initialPassCount) {
          console.log("New village pass detected!");
          setIsPurchasingPass(false);
        } else {
          console.log(`Polling for pass... Current: ${updatedPassCount}, Initial: ${initialPassCount}`);
          setTimeout(pollForNewPass, 3000);
        }
      };

      setTimeout(pollForNewPass, 3000);
    } catch (error) {
      console.error("Error opening starter pack:", error);
      setIsPurchasingPass(false);
    }
  };

  const handleSettleVillage = async () => {
    if (selectedRealm !== null && selectedDirection !== null && selectedVillagePass) {
      setIsLoading(true);
      try {
        await create_village({
          village_pass_token_id: selectedVillagePass.token_id,
          connected_realm: selectedRealm.connected_realm_entity_id,
          direction: selectedDirection,
          village_pass_address: getVillagePassAddress(),
          signer: account,
        });
        setCurrentStep(4);
        setShowResourceReveal(true);
      } catch (error) {
        console.error("Error settling village:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      console.warn("Attempted to settle village without required selections.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setAvailableVillages(await fetchRealmVillageSlots());
    };
    fetchData();
  }, [address]);

  useEffect(() => {
    if (address) {
      const fetchData = async () => {
        await refetchAndSetPasses();
      };
      fetchData();
    }
  }, [address]);

  useMemo(() => {
    const selectedLocation = availableVillages.find(
      (village) =>
        village.connected_realm_coord.col === realmCoords?.col &&
        village.connected_realm_coord.row === realmCoords?.row,
    );

    if (!selectedLocation) {
      setSelectedRealm(null);
      return null;
    }

    setSelectedRealm(selectedLocation);
  }, [availableVillages, realmCoords]);

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
      setSelectedDirection(null);
    } else {
      setDirectionOptions([]);
      setSelectedDirection(null);
    }
  }, [selectedRealm]);

  const filteredVillages = useMemo(() => {
    let filtered = availableVillages;

    if (realmSearchTerm) {
      filtered = filtered.filter((village) => village.connected_realm_id.toString().includes(realmSearchTerm));
    }

    if (selectedResourceFilter) {
      filtered = filtered.filter((village) => {
        const villageResources = getResources(village.connected_realm_entity_id);
        return villageResources.includes(selectedResourceFilter);
      });
    }

    return filtered;
  }, [availableVillages, realmSearchTerm, selectedResourceFilter, getResources]);

  const handlePassSelection = (pass: TokenTransfer) => {
    setSelectedVillagePass(pass);
    setCurrentStep(2);
  };

  const handleRealmSelection = (village: RealmVillageSlot | null) => {
    setSelectedRealm(village);
    setRealmCoords(village ? village.connected_realm_coord : null);
    setSelectedDirection(null);
  };

  const handleConfirmRealm = () => {
    if (selectedRealm) {
      setCurrentStep(3);
    }
  };

  const handleGoBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 3) {
        setSelectedDirection(null);
      }
      if (currentStep === 2) {
        setSelectedVillagePass(null);
      }
    }
  };

  return (
    <ModalContainer size="full" title={`Villages - Step ${currentStep}/4`}>
      <div className="h-full flex flex-col">
        <div className="flex justify-end p-2">
          {currentStep > 1 && currentStep < 4 && (
            <Button variant="default" size="md" onClick={handleGoBack} className="mr-2">
              Back
            </Button>
          )}
          <Button variant="danger" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-auto space-y-6 p-4">
          {currentStep === 1 && (
            <div>
              <h4 className="text-gold mb-4">1. Purchase a Village Pass</h4>
              <p className="text-xl text-gray-300 mb-4">
                <span className="font-bold text-2xl">Villages</span> are smaller settlements with fewer perks than
                Realms.
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>Each Realm has 6 possible village spots (one in each direction).</li>
                  <li>Villages support a more casual style of play and can't be captured by other players.</li>
                  <li>Villages have 20% production of the Realm they are on.</li>
                </ul>
              </p>
              <Button
                variant="gold"
                onClick={() => mintStarterPack("eternum-village-pass")}
                isLoading={isPurchasingPass}
                disabled={isPurchasingPass}
                className="mb-6"
              >
                {isPurchasingPass ? "Processing Purchase..." : "Purchase Village Pass $5 (CC or Crypto Accepted)"}
              </Button>

              {purchasedVillagePass.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-gold mt-4">1. Select an Available Village Pass</h4>
                  <div className="flex flex-wrap gap-2">
                    {purchasedVillagePass.map((pass) => (
                      <div
                        className={`p-4 h5 border panel-wood rounded-md cursor-pointer hover:bg-gold/10 ${
                          selectedVillagePass?.token_id === pass.token_id ? "bg-gold/10 ring-2 ring-gold" : ""
                        }`}
                        key={pass.token_id}
                        onClick={() => handlePassSelection(pass)}
                      >
                        <p>Pass #{pass.token_id}</p>
                      </div>
                    ))}
                  </div>
                  {isPurchasingPass && <div className="text-sm text-gray-400 mt-2"> Checking for new passes...</div>}
                </div>
              ) : (
                !isPurchasingPass && <p className="text-center text-gray-400 mt-4"></p>
              )}

              {/* Resource Probability Section */}
              <div className="my-6 ">
                <h3 className="text-gold mb-4 text-center">Possible Village Resources & Odds</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Column 1: Top 3 Tiers */}
                  <div className="space-y-4">
                    {topTiers.map((tier) => (
                      <div key={tier.name} className={cn("p-3 rounded border bg-dark-brown/10 border-gold/30")}>
                        <h6 className="font-bold text-lg mb-2 text-center">
                          {tier.name} ({tier.totalChance.toFixed(3)}%)
                        </h6>
                        <ul className="space-y-1">
                          {tier.resources.map((resource) => (
                            <li key={resource.name} className="flex justify-between items-center text-xl">
                              <span className="flex items-center gap-1">
                                <ResourceIcon resource={resource.name} size="xs" />
                                {resource.name}
                              </span>
                              <span>{resource.chance.toFixed(2)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Column 2: Bottom 3 Tiers */}
                  <div className="space-y-4">
                    {bottomTiers.map((tier) => (
                      <div key={tier.name} className={cn("p-3 rounded border bg-dark-brown/10 border-gold/30")}>
                        <h6 className="font-bold text-lg mb-2 text-center">
                          {tier.name} ({tier.totalChance.toFixed(3)}%)
                        </h6>
                        <ul className="space-y-1">
                          {tier.resources.map((resource) => (
                            <li key={resource.name} className="flex justify-between items-center text-xl">
                              <span className="flex items-center gap-1">
                                <ResourceIcon resource={resource.name} size="xs" />
                                {resource.name}
                              </span>
                              <span>{resource.chance.toFixed(2)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-center text-gray-300 mt-4 text-sm italic">
                  There is a ~90% chance of rolling a Common or Uncommon resource, and a ~10% chance of a Rare, Epic,
                  Legendary or Mythic resource.
                </p>
              </div>
              {/* End Resource Probability Section */}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h4 className="text-gold mb-4">2. Select a Realm for Your Village</h4>
              <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-8">
                <div className="w-full md:w-96 space-y-4 flex-shrink-0">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h5 className="text-gold">Search by Realm ID</h5>
                    </div>
                    <input
                      type="text"
                      placeholder="Search Realm ID..."
                      value={realmSearchTerm}
                      onChange={(e) => setRealmSearchTerm(e.target.value)}
                      className="w-full p-2 bg-dark-brown border border-gold/30 rounded-md text-gold placeholder-gold/50 focus:outline-none focus:ring-0 focus:border-gold"
                      disabled={isLoading || availableVillages.length === 0}
                    />
                  </div>

                  <div>
                    <h5 className="text-gold mb-1 pt-2">Or Select Realm from List</h5>
                    <Select
                      value={selectedRealm?.connected_realm_entity_id.toString() ?? ""}
                      onValueChange={(value) => {
                        const entityId = Number(value);
                        const village = availableVillages.find((v) => v.connected_realm_entity_id === entityId);
                        handleRealmSelection(village || null);
                      }}
                      disabled={isLoading || availableVillages.length === 0}
                    >
                      <SelectTrigger className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold">
                        <SelectValue
                          placeholder={
                            availableVillages.length > 0
                              ? filteredVillages.length > 0
                                ? "Select an Available Realm"
                                : "No matching Realms found"
                              : "Loading available Realms..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredVillages.map((village) => (
                          <SelectItem
                            key={village.connected_realm_entity_id}
                            value={village.connected_realm_entity_id.toString()}
                          >
                            {`Realm #${village.connected_realm_id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedRealm && (
                    <div className="mt-4 bg-dark-brown rounded-md">
                      <h5 className="text-gold mb-2">
                        Selected Realm: <br />
                      </h5>
                      <h4 className="mb-4">
                        {getRealmName(selectedRealm.connected_realm_id)} (#
                        {selectedRealm.connected_realm_id})
                      </h4>

                      <Button variant="gold" onClick={handleConfirmRealm} className="w-full">
                        Confirm Realm & Select Direction
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h5 className="text-gold mb-2">Or Select Realm on Map</h5>
                  <div className="border border-gold/30 rounded-md overflow-hidden w-1/2">
                    <SettlementMinimap
                      onSelectLocation={(location) => {
                        const village = availableVillages.find(
                          (v) =>
                            v.connected_realm_coord.col === location.x && v.connected_realm_coord.row === location.y,
                        );
                        handleRealmSelection(village || null);
                        console.log(location);
                      }}
                      onConfirm={() => {}}
                      maxLayers={50}
                      extraPlayerOccupiedLocations={[]}
                      villageSelect={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && selectedRealm && (
            <div>
              <h4 className="text-gold mb-4">3. Confirm Village Details</h4>
              <div className="flex flex-col md:flex-row gap-12  bg-dark-brown/50">
                <div className="space-y-4">
                  <h2>
                    {getRealmName(selectedRealm.connected_realm_id)} (#{selectedRealm.connected_realm_id})
                  </h2>
                  <div className="w-full md:w-96 pt-4">
                    <h6 className="text-base mb-2">Village Direction:</h6>
                    {/* need to flip north and south because of the way the worldmap is oriented */}
                    <div className="grid grid-cols-3 gap-2 mx-auto my-4">
                      <DirectionButton
                        direction={Direction.SOUTH_WEST}
                        label="↖"
                        tooltip="North West"
                        availableDirections={directionOptions.map((opt) => opt.value)}
                        selectedDirection={selectedDirection}
                        onClick={setSelectedDirection}
                      />
                      <div />
                      <DirectionButton
                        direction={Direction.SOUTH_EAST}
                        label="↗"
                        tooltip="North East"
                        availableDirections={directionOptions.map((opt) => opt.value)}
                        selectedDirection={selectedDirection}
                        onClick={setSelectedDirection}
                      />
                      <DirectionButton
                        direction={Direction.WEST}
                        label="←"
                        tooltip="West"
                        availableDirections={directionOptions.map((opt) => opt.value)}
                        selectedDirection={selectedDirection}
                        onClick={setSelectedDirection}
                      />
                      <div className="flex items-center justify-center text-4xl ">🏰</div>
                      <DirectionButton
                        direction={Direction.EAST}
                        label="→"
                        tooltip="East"
                        availableDirections={directionOptions.map((opt) => opt.value)}
                        selectedDirection={selectedDirection}
                        onClick={setSelectedDirection}
                      />
                      <DirectionButton
                        direction={Direction.NORTH_WEST}
                        label="↙"
                        tooltip="South West"
                        availableDirections={directionOptions.map((opt) => opt.value)}
                        selectedDirection={selectedDirection}
                        onClick={setSelectedDirection}
                      />
                      <div />
                      <DirectionButton
                        direction={Direction.NORTH_EAST}
                        label="↘"
                        tooltip="South East"
                        availableDirections={directionOptions.map((opt) => opt.value)}
                        selectedDirection={selectedDirection}
                        onClick={setSelectedDirection}
                      />
                    </div>

                    {directionOptions.length === 0 && (
                      <div className="text-xs text-red-400 mt-1 text-center">
                        No available spots for this realm. This can happen if mines or hyperstructures are discovered on
                        the village spots.
                      </div>
                    )}

                    <Button
                      variant="gold"
                      className="w-full mt-4"
                      onClick={handleSettleVillage}
                      disabled={selectedDirection === null || isLoading || directionOptions.length === 0}
                      isLoading={isLoading}
                    >
                      {isLoading ? "Minting..." : "Confirm and Settle Village"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && villageCoords && showResourceReveal && (
            <>
              <h4 className="text-gold mb-4">4. Village Settled & Resource Revealed!</h4>
              <VillageResourceReveal
                villageCoords={villageCoords}
                onClose={onClose}
                onRestart={() => {
                  setShowResourceReveal(false);
                  setRealmCoords(null);
                  setSelectedDirection(null);
                  setSelectedRealm(null);
                  setSelectedVillagePass(null);
                  setCurrentStep(1);
                  refetchAndSetPasses();
                }}
              />
            </>
          )}
        </div>
      </div>
    </ModalContainer>
  );
};

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

interface DirectionButtonProps {
  direction: Direction;
  label: string;
  tooltip: string;
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  onClick: (direction: Direction) => void;
}

const DirectionButton: React.FC<DirectionButtonProps> = ({
  direction,
  label,
  tooltip,
  availableDirections,
  selectedDirection,
  onClick,
}) => {
  const isAvailable = availableDirections.includes(direction);
  const isSelected = selectedDirection === direction;

  return (
    <Button
      variant={isSelected ? "gold" : isAvailable ? "default" : "outline"}
      size="md"
      onClick={() => isAvailable && onClick(direction)}
      disabled={!isAvailable}
      className={`aspect-square text-lg ${isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
      title={tooltip}
    >
      {label}
    </Button>
  );
};
