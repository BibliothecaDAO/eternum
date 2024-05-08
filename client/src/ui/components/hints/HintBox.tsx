import { useDojo } from "@/hooks/context/DojoContext";
import { useEntityArmies } from "@/hooks/helpers/useArmies";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { useGetMyOffers } from "@/hooks/helpers/useTrade";
import Button from "@/ui/elements/Button";
import { BuildingType } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";

export const STARTING_ID_FOOD = 1;
export const STARTING_ID_COMMON_RESOURCES = 2;
export const STARTING_ID_UNCOMMON_RESOURCES = 3;
export const STARTING_ID_UNIQUE_RESOURCES = 4;
export const STARTING_ID_RARE_RESOURCES = 5;
export const STARTING_ID_LEGENDARY_RESOURCES = 6;
export const STARTING_ID_MYTHIC_RESOURCES = 7;
export const STARTING_ID_TRADE = 8;
export const STARTING_ID_MILITARY = 9;
export const STARTING_EARTHENSHARD = 10;

export enum ClaimIds {
  StartingFood = STARTING_ID_FOOD,
  StartingCommonResources = STARTING_ID_COMMON_RESOURCES,
  StartingUncommonResources = STARTING_ID_UNCOMMON_RESOURCES,
  StartingUniqueResources = STARTING_ID_UNIQUE_RESOURCES,
  StartingRareResources = STARTING_ID_RARE_RESOURCES,
  StartingLegendaryResources = STARTING_ID_LEGENDARY_RESOURCES,
  StartingMythicResources = STARTING_ID_MYTHIC_RESOURCES,
  StartingTrade = STARTING_ID_TRADE,
  StartingMilitary = STARTING_ID_MILITARY,
  StartingEarthenShard = STARTING_EARTHENSHARD,
}

interface Quest {
  name: string;
  description: string;
  steps: Step[];
  completed?: boolean;
  prizes: Prize[];
}

interface Step {
  description: string;
}

interface Prize {
  id: number;
  title: string;
}

export const HintBox = ({ quest, entityId }: { quest: Quest; entityId: bigint }) => {
  const {
    setup: {
      components: { HasClaimedStartingResources },
      systemCalls: { mint_starting_resources },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const handleClaimResources = async (config_id: string) => {
    setIsLoading(true); // Start loading
    try {
      await mint_starting_resources({
        signer: account,
        config_id: config_id,
        realm_entity_id: entityId || "0",
      });
    } catch (error) {
      console.error("Failed to claim resources:", error);
    } finally {
      setIsLoading(false); // Stop loading regardless of success or failure
    }
  };

  return (
    <div className={`p-2 border border-white/30  text-gold  ${quest.completed ? "bg-green/5" : " "}`}>
      <h5 className="mb-3">{quest.name}</h5>

      <p>{quest.description}</p>

      <div className="mt-1 grid grid-cols-3">
        {quest.completed &&
          quest.prizes.map((prize, index) => {
            const hasClaimed = getComponentValue(
              HasClaimedStartingResources,
              getEntityIdFromKeys([BigInt(entityId), BigInt(prize.id)]),
            );
            return (
              <Button
                key={index}
                isLoading={isLoading}
                disabled={hasClaimed?.claimed}
                variant="primary"
                onClick={() => handleClaimResources(prize.id.toString())}
              >
                {hasClaimed?.claimed ? "Claimed" : prize.title}
              </Button>
            );
          })}
      </div>
    </div>
  );
};

export const QuestList = () => {
  const {
    setup: {
      components: { BuildingQuantityv2 },
    },
  } = useDojo();

  const { realm } = useHexPosition();

  const farms = useMemo(() => {
    const quantity =
      getComponentValue(
        BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(realm?.entity_id || "0"), BigInt(BuildingType.Farm)]),
      )?.value || 0;

    return quantity;
  }, [realm]);

  const resource = useMemo(() => {
    const quantity =
      getComponentValue(
        BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(realm?.entity_id || "0"), BigInt(BuildingType.Resource)]),
      )?.value || 0;

    return quantity;
  }, [realm]);

  const orders = useGetMyOffers();

  const { entityArmies } = useEntityArmies({ entity_id: realm?.entity_id || BigInt("0") });

  const quests = useMemo(() => {
    return [
      {
        name: "Claim Food",
        description: "A gift from the gods to start your journey.",
        completed: true,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: ClaimIds.StartingFood,
            title: "Resources Claim",
          },
        ],
      },
      {
        name: "Build a Farm",
        description: "Wheat is the lifeblood of your people. Build a farm to feed them.",
        completed: farms > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: ClaimIds.StartingCommonResources,
            title: "Common Resources",
          },
          {
            id: ClaimIds.StartingUncommonResources,
            title: "Uncommon Resources",
          },
          {
            id: ClaimIds.StartingRareResources,
            title: "Rare Claim",
          },
          {
            id: ClaimIds.StartingUniqueResources,
            title: "Unique Claim",
          },
          {
            id: ClaimIds.StartingLegendaryResources,
            title: "Legendary Claim",
          },
          {
            id: ClaimIds.StartingMythicResources,
            title: "Mythic Claim",
          },
        ],
      },
      {
        name: "Build a Resource",
        description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
        completed: resource > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: ClaimIds.StartingTrade,
            title: "Donkeys and Lords",
          },
        ],
      },
      {
        name: "Create a Trade",
        description: "Trading is the lifeblood of Eternum. Create a trade to start your economy.",
        completed: orders.length > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: ClaimIds.StartingMilitary,
            title: "Claim Starting Army",
          },
        ],
      },
      {
        name: "Create an Army",
        description: "Conquest is fufilling. Create an army to conquer your enemies.",
        completed: entityArmies().length > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: ClaimIds.StartingEarthenShard,
            title: "Claim Earthen Shard",
          },
        ],
      },
    ];
  }, [farms, resource, orders, entityArmies()]);

  return (
    <div className="p-8 flex flex-col gap-2">
      {quests.map((quest, index) => (
        <HintBox key={index} quest={quest} entityId={realm?.entity_id || BigInt("0")} />
      ))}
    </div>
  );
};
