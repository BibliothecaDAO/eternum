import { Prize } from "@/hooks/helpers/useQuests";
import { BUILDING_IMAGES_PATH, BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { multiplyByPrecision } from "@/ui/utils/utils";
import {
  BASE_POPULATION_CAPACITY,
  BuildingType,
  CapacityConfigCategory,
  EternumGlobalConfig,
  QuestType,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import clsx from "clsx";
import { ResourceWeight } from "../resources/ResourceWeight";

interface StaticQuestInfo {
  name: string;
  description: string | React.ReactNode;
  steps: (string | React.ReactNode)[];
  prizes: Prize[];
  depth: number;
}

const navigationStep = (imgPath: string) => {
  return (
    <div className="flex flex-row items-center">
      <p>1. Open the</p>
      <CircleButton
        // disabled={true}
        className={"pointer-events-none mx-2"}
        image={imgPath}
        tooltipLocation="top"
        size="lg"
        onClick={() => {}}
      />
      <p>menu</p>
    </div>
  );
};

export enum QuestId {
  Settle,
  BuildFarm,
  BuildResource,
  PauseProduction,
  CreateTrade,
  CreateDefenseArmy,
  CreateArmy,
  Travel,
  BuildWorkersHut,
  Market,
  Pillage,
  Mine,
  Contribution,
  Hyperstructure,
}

export const questDetails = new Map<QuestId, StaticQuestInfo>([
  [
    QuestId.Settle,
    {
      name: "Settle",
      description: "A gift of food from the gods",
      steps: [],
      prizes: [{ id: QuestType.Food, title: "Common Resources" }],
      depth: 0,
    },
  ],
  [
    QuestId.BuildFarm,
    {
      name: "Build a Farm",
      description: "Wheat is the lifeblood of your people. Go to the construction menu and build a farm",
      steps: [
        navigationStep(BuildingThumbs.construction),
        <div className="flex flex-row items-center">
          <p>2. Select the </p>
          <div
            style={{
              backgroundImage: `url(${BUILDING_IMAGES_PATH[BuildingType.Farm]})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            className={clsx("text-gold overflow-hidden text-ellipsis  cursor-pointer relative h-24 w-16")}
          ></div>
          <p>building</p>
        </div>,
        <p>3. Left click on a hex to build it, or right click to cancel</p>,
      ],
      prizes: [
        { id: QuestType.CommonResources, title: "Common Resources" },
        { id: QuestType.UncommonResources, title: "Uncommon Resources" },
        { id: QuestType.RareResources, title: "Rare Resources" },
        { id: QuestType.UniqueResources, title: "Unique Resources" },
        { id: QuestType.LegendaryResources, title: "Legendary Resources" },
        { id: QuestType.MythicResources, title: "Mythic Resources" },
      ],
      depth: 1,
    },
  ],
  [
    QuestId.BuildResource,
    {
      name: "Build a Resource Facility",
      description: (
        <div className="space-y-2">
          <div>Eternum thrives on resources. Construct resource facilities to harvest them efficiently.</div>
          <div>
            For each farm next to your resource facility you gain a{" "}
            <span className="font-bold text-order-brilliance">10%</span> boost in production.
          </div>
        </div>
      ),
      steps: [
        navigationStep(BuildingThumbs.construction),
        "2. Select one of the Resource Buildings in the 'Resources' tab",
        "3. Left click on a hex to build it, or right click to cancel",
      ],
      prizes: [{ id: QuestType.Trade, title: "Donkeys and Lords" }],
      depth: 2,
    },
  ],
  [
    QuestId.PauseProduction,
    {
      name: "Pause Production",
      description:
        "Resource facilities will produce resources automatically. Pause production to stop its consumption.",
      steps: ["1. Left mouse click on the building's model", "2. Pause its production"],
      prizes: [{ id: QuestType.PauseProduction, title: "Pause Production" }],
      depth: 3,
    },
  ],
  [
    QuestId.CreateTrade,
    {
      name: "Create a Trade",
      description: "Trading is the lifeblood of Eternum. Create a trade to start your economy",
      steps: [navigationStep(BuildingThumbs.scale), "2. Create a 'Buy' or 'Sell' order."],
      prizes: [{ id: QuestType.Military, title: "Claim Starting Army" }],
      depth: 3,
    },
  ],
  [
    QuestId.CreateDefenseArmy,
    {
      name: "Create a Defensive Army",
      description: "Your realm is always at risk. Create a defensive army to protect it",
      steps: [
        navigationStep(BuildingThumbs.military),
        "2. Create a defensive army for your realm",
        "3. Remember to assign troops to it, or else your enemies can claim your realm for free!",
      ],
      prizes: [{ id: QuestType.CreateDefenseArmy, title: "Create Defensive Army" }],
      depth: 4,
    },
  ],
  [
    QuestId.CreateArmy,
    {
      name: "Create an Army",
      description: "Conquest is fulfilling. Create an army to conquer your enemies",
      steps: [
        navigationStep(BuildingThumbs.military),
        "2. Create an attacking army",
        "3. Assign troops to it to conquer the map",
      ],
      prizes: [{ id: QuestType.Earthenshard, title: "Claim Earthen Shard" }],
      depth: 4,
    },
  ],
  [
    QuestId.Travel,
    {
      name: "Move with your Army",
      description: (
        <div className="space-y-4 text-base">
          <p>
            Move your army across the world map using two methods: <strong>travel</strong> and <strong>explore</strong>.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <h4 className="text-xl font-bold mb-3 text-gold">Travel</h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="mr-2">🏃‍♂️</span>
                  Costs{" "}
                  <span className="font-semibold text-brilliance mx-1">
                    {EternumGlobalConfig.stamina.travelCost}
                  </span>{" "}
                  stamina per hex
                </li>
                <li>
                  <span className="mr-2">🍖</span>
                  Consumes per hex:
                  <ul className="ml-6 mt-2 space-y-2">
                    <li className="flex items-center">
                      <span className="font-semibold text-brilliance mr-2">
                        {multiplyByPrecision(EternumGlobalConfig.exploration.travelFishBurn)}
                      </span>
                      <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                      <span>per troop</span>
                    </li>
                    <li className="flex items-center">
                      <span className="font-semibold text-brilliance mr-2">
                        {multiplyByPrecision(EternumGlobalConfig.exploration.travelWheatBurn)}
                      </span>
                      <ResourceIcon className="mr-1" size="md" resource={ResourcesIds[ResourcesIds.Wheat]} />
                      <span>per troop</span>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <h4 className="text-xl font-bold mb-3 text-gold">Explore</h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="mr-2">🌎</span>
                  Costs{" "}
                  <span className="font-semibold text-brilliance mx-1">
                    {EternumGlobalConfig.stamina.exploreCost}
                  </span>{" "}
                  stamina per hex
                </li>
                <li>
                  <span className="mr-2">🍖</span>
                  Consumes per hex:
                  <ul className="ml-6 mt-2 space-y-2">
                    <li className="flex items-center">
                      <span className="font-semibold text-brilliance mr-2">
                        {multiplyByPrecision(EternumGlobalConfig.exploration.exploreFishBurn)}
                      </span>
                      <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                      <span>per troop</span>
                    </li>
                    <li className="flex items-center">
                      <span className="font-semibold text-brilliance mr-2">
                        {multiplyByPrecision(EternumGlobalConfig.exploration.exploreWheatBurn)}
                      </span>
                      <ResourceIcon className="mr-1" size="md" resource={ResourcesIds[ResourcesIds.Wheat]} />
                      <span>per troop</span>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ),
      steps: ["1. Go to world view", "2. Right click on your army", "3. Explore or travel with your army"],
      prizes: [{ id: QuestType.Travel, title: "Travel" }],
      depth: 5,
    },
  ],
  [
    QuestId.BuildWorkersHut,
    {
      name: "Build a workers hut",
      description: `Each building takes up population in your realm. You realm starts with a population of ${BASE_POPULATION_CAPACITY}. 
      Build worker huts to extend your population capacity by ${EternumGlobalConfig.populationCapacity.workerHuts}.`,
      steps: [],
      prizes: [{ id: QuestType.Population, title: "Population" }],
      depth: 6,
    },
  ],
  [
    QuestId.Market,
    {
      name: "Build a market",
      description: (
        <div>
          <div className="mt-2">Build a market to produce donkeys. Donkeys are a resource used to transport goods.</div>{" "}
          <div className="flex flex-row mt-2">
            <ResourceIcon size="sm" resource={"Donkeys"} />
            <div>
              {" "}
              Donkeys can transport {EternumGlobalConfig.carryCapacityGram[CapacityConfigCategory.Donkey] /
                1000} kg{" "}
            </div>
          </div>
          <ResourceWeight className="mt-2" />
        </div>
      ),
      steps: [],
      prizes: [{ id: QuestType.Market, title: "Market" }],
      depth: 6,
    },
  ],
  [
    QuestId.Pillage,
    {
      name: "Pillage a structure",
      description:
        "Pillage a realm, hyperstructure or earthenshard mine. To pillage a structure, travel with your army to your target first, then pillage it.",
      steps: [],
      prizes: [{ id: QuestType.Pillage, title: "Pillage" }],
      depth: 6,
    },
  ],
  [
    QuestId.Mine,
    {
      name: "Discover an earthenshard mine",
      description: "Explore the world, find earthenshard mines",
      steps: [],
      prizes: [{ id: QuestType.Mine, title: "Mine" }],
      depth: 6,
    },
  ],
  [
    QuestId.Contribution,
    {
      name: "Contribute to a hyperstructure",
      description: "Contribute to a Hyperstructure",
      steps: [],
      prizes: [{ id: QuestType.Contribution, title: "Contribution" }],
      depth: 6,
    },
  ],
  [
    QuestId.Hyperstructure,
    {
      name: "Build a hyperstructure",
      description: "Build a Hyperstructure",
      steps: [],
      prizes: [{ id: QuestType.Hyperstructure, title: "Hyperstructure" }],
      depth: 6,
    },
  ],
]);
