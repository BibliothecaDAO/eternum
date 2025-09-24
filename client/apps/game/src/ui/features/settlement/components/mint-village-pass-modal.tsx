import { sqlApi } from "@/services/api";
import Button from "@/ui/design-system/atoms/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { ModalContainer } from "@/ui/shared";
import { useDojo } from "@bibliothecadao/react";
import { RealmVillageSlot, TokenTransfer } from "@bibliothecadao/torii";
import { Direction, getNeighborHexes, HexPosition, Steps } from "@bibliothecadao/types";
import { ControllerConnector } from "@cartridge/connector";
import { useAccount } from "@starknet-react/core";
import { useEffect, useMemo, useState } from "react";
import { SettlementMinimap } from "./settlement-minimap";
import { VillageResourceReveal } from "./village-resource-reveal";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getVillagePassAddress } from "@/utils/addresses";
import { ArrowRightIcon } from "lucide-react";
import RealmJson from "../../../../../../../public/jsons/realms.json";
import { env } from "../../../../../env";

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

enum ResourceTier {
  Common = "Common",
  Uncommon = "Uncommon",
  Rare = "Rare",
  Epic = "Epic",
  Legendary = "Legendary",
  Mythic = "Mythic",
}

export const ResourceTierEmojis = {
  [ResourceTier.Common]: "🟢", // green
  [ResourceTier.Uncommon]: "🔵", // blue
  [ResourceTier.Rare]: "🟣", // purple
  [ResourceTier.Epic]: "🟠", // orange
  [ResourceTier.Legendary]: "🔴", // red
  [ResourceTier.Mythic]: "⚫", // black (ultimate rarity)
};

export const resourceProbabilities: RarityTier[] = [
  {
    name: ResourceTier.Common,
    totalChance: 50.43,
    color: "bg-gray-600 border-gray-400",
    resources: [
      { name: "Wood", chance: 19.815 },
      { name: "Stone", chance: 15.556 },
      { name: "Coal", chance: 15.062 },
    ],
  },
  {
    name: ResourceTier.Uncommon,
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
    name: ResourceTier.Rare,
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
    name: ResourceTier.Epic,
    totalChance: 2.5,
    color: "bg-purple-800 border-purple-600",
    resources: [
      { name: "Deep Crystal", chance: 1.049 },
      { name: "Ignium", chance: 0.71 },
      { name: "Ethereal Silica", chance: 0.741 },
    ],
  },
  {
    name: ResourceTier.Legendary,
    totalChance: 1.451,
    color: "bg-indigo-800 border-indigo-600",
    resources: [
      { name: "True Ice", chance: 0.556 },
      { name: "Twilight Quartz", chance: 0.494 },
      { name: "Alchemical Silver", chance: 0.401 },
    ],
  },
  {
    name: ResourceTier.Mythic,
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
  const [isSelectingPass, setIsSelectingPass] = useState(false);

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
        const tokenTransfers = await sqlApi.fetchTokenTransfers(
          getVillagePassAddress(),
          "0x" + BigInt(address).toString(16),
        );
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
      setAvailableVillages(await sqlApi.fetchRealmVillageSlots());
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
    setIsSelectingPass(true);
    setSelectedVillagePass(pass);
    setCurrentStep(2);
    setIsSelectingPass(false);
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

  const villagePassString =
    env.VITE_PUBLIC_CHAIN === "mainnet" ? `eternum-village-pass-mainnet` : `eternum-village-pass`;

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
              <h3 className="text-3xl font-bold text-gold mb-6 text-center">Step 1: Acquire Your Village Pass</h3>

              {env.VITE_PUBLIC_SHOW_END_GAME_WARNING && (
                <div className="mb-8 p-4 bg-red-900/20 border border-red-500 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border border-red-400">
                      i
                    </div>
                    <h4 className="text-red-400 font-semibold text-lg">Season Update</h4>
                  </div>
                  <p className="text-red-200 leading-relaxed">
                    Before you buy a village, know the game is approaching its end state. You can play fully and collect
                    achievements, but the game world will likely terminate within a week.
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-8 items-start mb-8">
                {/* Right Column: Purchase and Selection - MOVED TO LEFT */}
                <div className="space-y-6 md:order-1">
                  {" "}
                  {/* Added md:order-1 */}
                  <div>
                    <h5 className="text-xl font-semibold text-gold mb-3">Information</h5>
                    <p className="text-lg text-gray-300 leading-relaxed mt-4">
                      <span className="font-semibold text-xl text-gold">Villages</span> offer a unique way to expand
                      your presence in Realms. They are smaller settlements, perfect for a more casual playstyle, and
                      cannot be captured by others.
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1  mb-4">
                      <li>Each Realm can support up to 6 Villages, one in each direction.</li>
                      <li>Villages benefit from 20% of their connected Realm's production.</li>
                      <li>Villages have one resource type that is random.</li>
                    </ul>
                    <Button
                      variant="gold"
                      onClick={() => mintStarterPack(villagePassString)}
                      isLoading={isPurchasingPass}
                      disabled={isPurchasingPass || isSelectingPass}
                      className="w-full py-8"
                    >
                      {isPurchasingPass ? "Processing Purchase..." : "Purchase Village Pass ($5)"}
                    </Button>
                    <p className="text-xs text-gray-500 mt-1 text-center">(Credit Card or Crypto Accepted)</p>
                  </div>
                  {purchasedVillagePass.length > 0 && (
                    <div className="pt-4 border-t border-gold/20 mt-6">
                      <h4 className="text-xl font-semibold text-gold mb-3">Select an Available Pass</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {purchasedVillagePass.map((pass) => (
                          <Button
                            variant="outline"
                            key={pass.token_id}
                            onClick={() => handlePassSelection(pass)}
                            disabled={isSelectingPass || isPurchasingPass}
                            isLoading={isSelectingPass && selectedVillagePass?.token_id === pass.token_id}
                            className={cn(
                              "p-3 border rounded-lg cursor-pointer transition-all duration-150 ease-in-out",
                              "text-center /30 hover:bg-gold/20 border-gold/30",
                              selectedVillagePass?.token_id === pass.token_id
                                ? "bg-gold/20 ring-2 ring-gold shadow-lg scale-105"
                                : "hover:shadow-md",
                            )}
                          >
                            <div className="font-semibold text-gold flex justify-between w-full items-center">
                              Pass #{pass.token_id}{" "}
                              {!(isSelectingPass && selectedVillagePass?.token_id === pass.token_id) && (
                                <ArrowRightIcon className="w-4 h-4 ml-2 self-center" />
                              )}
                            </div>
                          </Button>
                        ))}
                      </div>
                      {isPurchasingPass && (
                        <div className="text-sm text-yellow-400 mt-3 text-center animate-pulse">
                          Checking for new passes...
                        </div>
                      )}
                    </div>
                  )}
                  {!purchasedVillagePass.length && !isPurchasingPass && (
                    <p className="text-center text-gray-500 mt-6 text-sm">
                      You currently have no Village Passes. Purchase one to continue.
                    </p>
                  )}
                </div>

                {/* Left Column: Image and Info - MOVED TO RIGHT */}
                <div className="space-y-4 pr-4 md:order-2">
                  {" "}
                  {/* Added md:order-2 */}
                  <img
                    src="/images/buildings/construction/castleOne.png" // Path relative to the public directory
                    alt="Village Pass Illustration"
                    className="w-full mx-auto  object-contain"
                  />
                </div>
              </div>

              {/* Resource Probability Section - Clearer Separation */}
              <div className="my-10 pt-8 border-t-2 border-gold/20">
                <h3 className="text-2xl font-bold text-gold mb-6 text-center">Possible Village Resources &amp; Odds</h3>
                <p className="text-center text-gray-300 mb-6 text-sm italic">
                  Each Village Pass, when settled, will reveal one of the following resources based on these odds. There
                  is a ~90% chance of rolling a Common or Uncommon resource, and a ~10% chance for Rare or rarer.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Column 1: Top 3 Tiers */}
                  <div className="space-y-4">
                    {topTiers.map((tier) => (
                      <div
                        key={tier.name}
                        className={cn(
                          "p-4 rounded-lg border /20 border-gold/40 shadow-md hover:shadow-lg transition-shadow",
                        )}
                      >
                        <h6 className="font-bold text-xl mb-3 text-center text-gold flex items-center justify-center">
                          <span className=" text-sm mr-1.5">
                            {ResourceTierEmojis[tier.name as keyof typeof ResourceTierEmojis]}
                          </span>
                          {tier.name} <span className=" text-sm ml-1.5">({tier.totalChance.toFixed(2)}% total)</span>
                        </h6>
                        <ul className="space-y-1.5">
                          {tier.resources.map((resource) => (
                            <li key={resource.name} className="flex justify-between items-center text-md text-gray-200">
                              <span className="flex items-center gap-2">
                                <ResourceIcon resource={resource.name} size="sm" />
                                {resource.name}
                              </span>
                              <span className="">{resource.chance.toFixed(2)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Column 2: Bottom 3 Tiers */}
                  <div className="space-y-4">
                    {bottomTiers.map((tier) => (
                      <div
                        key={tier.name}
                        className={cn(
                          "p-4 rounded-lg border /20 border-gold/40 shadow-md hover:shadow-lg transition-shadow",
                        )}
                      >
                        <h6 className="font-bold text-xl mb-3 text-center text-gold flex items-center justify-center">
                          <span className=" text-sm mr-1.5">
                            {ResourceTierEmojis[tier.name as keyof typeof ResourceTierEmojis]}
                          </span>
                          {tier.name} <span className=" text-sm ml-1.5">({tier.totalChance.toFixed(2)}% total)</span>
                        </h6>
                        <ul className="space-y-1.5">
                          {tier.resources.map((resource) => (
                            <li key={resource.name} className="flex justify-between items-center text-md text-gray-200">
                              <span className="flex items-center gap-2">
                                <ResourceIcon resource={resource.name} size="sm" />
                                {resource.name}
                              </span>
                              <span className="">{resource.chance.toFixed(2)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-center  mt-6 text-xs italic">
                  Note: Percentages are approximate and subject to minor variations.
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
                      className="w-full p-2  border border-gold/30 rounded-md text-gold placeholder-gold/50 focus:outline-none focus:ring-0 focus:border-gold bg-transparent"
                      disabled={isLoading || availableVillages.length === 0}
                    />
                  </div>

                  <div>
                    <h5 className="text-gold mb-1 pt-2">Select Realm</h5>
                    <Select
                      value={selectedRealm?.connected_realm_entity_id.toString() ?? ""}
                      onValueChange={(value) => {
                        const entityId = Number(value);
                        const village = availableVillages.find((v) => v.connected_realm_entity_id === entityId);
                        handleRealmSelection(village || null);
                      }}
                      disabled={isLoading || availableVillages.length === 0}
                    >
                      <SelectTrigger className="w-full p-2 pr-8  border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold">
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
                    <div className="mt-4">
                      <h2 className="mb-4">
                        {getRealmName(selectedRealm.connected_realm_id)} (#
                        {selectedRealm.connected_realm_id})
                      </h2>

                      <Button variant="gold" onClick={handleConfirmRealm} className="w-full">
                        Confirm <ArrowRightIcon className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h5 className="text-gold mb-2">Select Realm on Map</h5>
                  <div className="overflow-hidden w-1/2">
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
                      showSelectButton={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && selectedRealm && (
            <div>
              <h4 className="text-gold mb-4">3. Confirm Village Details</h4>
              <div className="flex flex-col md:flex-row gap-12  /50">
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
