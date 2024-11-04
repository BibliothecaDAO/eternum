import { configManager } from "@/dojo/setup";
import { Prize } from "@/hooks/helpers/useQuests";
import { BUILDING_IMAGES_PATH, BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { BuildingType, CapacityConfigCategory, QuestType, ResourcesIds } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { ResourceWeight } from "../resources/TravelInfo";
import { ExplorationTable } from "../hints/TheMap";

interface StaticQuestInfo {
  name: string;
  view: string;
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
  Settle = 1,
  BuildFood,
  BuildResource,
  PauseProduction,
  CreateTrade,
  CreateDefenseArmy,
  CreateAttackArmy,
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
      view: "",
      description: (
        <div className="space-y-2">
          <p>A gift of food from the gods.</p>

          <p>No action required to finish the quest.</p>

          <p>Simply claim your rewards.</p>
        </div>
      ),
      steps: [],
      prizes: [{ id: QuestType.Food, title: "Common Resources" }],
      depth: 0,
    },
  ],
  [
    QuestId.BuildFood,
    {
      name: "Build a Farm or a Fishing Village",
      view: "REALM",
      description:
        "Wheat and Fish are the lifeblood of your people. Go to the construction menu and build a Farm or a Fishing Village",
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
          <p>or</p>
          <div
            style={{
              backgroundImage: `url(${BUILDING_IMAGES_PATH[BuildingType.FishingVillage]})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            className={clsx("text-gold overflow-hidden text-ellipsis  cursor-pointer relative h-24 w-16")}
          ></div>
          <p>building</p>
        </div>,
        <p>
          3. Left click on a hex to build it, or right click to cancel. You can also press{" "}
          <strong>
            <span className="border border-gold px-1">Esc</span>
          </strong>{" "}
          to cancel the action.
        </p>,
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
      view: "REALM",
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
      prizes: [{ id: QuestType.Trade, title: "Donkeys" }],
      depth: 2,
    },
  ],
  [
    QuestId.PauseProduction,
    {
      name: "Pause Production",
      view: "REALM",
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
      view: "",
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
      view: "REALM",
      description: "Your realm is always at risk. Create a defensive army to protect it",
      steps: [
        navigationStep(BuildingThumbs.military),
        "2. Create a defensive army for your realm",
        "3. Assign troops to it, or else your enemies can claim your realm for free!",
      ],
      prizes: [{ id: QuestType.CreateDefenseArmy, title: "Create Defensive Army" }],
      depth: 4,
    },
  ],
  [
    QuestId.CreateAttackArmy,
    {
      name: "Create an attacking Army",
      view: "REALM",
      description: "Conquest is fulfilling. Create an attacking army to conquer your enemies",
      steps: [
        navigationStep(BuildingThumbs.military),
        "2. Create an attacking army",
        "3. Assign troops to it to conquer the map",
      ],
      prizes: [{ id: QuestType.FragmentMine, title: "Claim Ancient Fragments" }],
      depth: 4,
    },
  ],
  [
    QuestId.Travel,
    {
      name: "Move with your Army",
      view: "WORLD",
      description: (
        <div className="space-y-4 text-base">
          <p>
            Move your army across the world map using two methods: <strong>travel</strong> and <strong>explore</strong>.
          </p>
          <ExplorationTable />
        </div>
      ),
      steps: [
        "1. Go to world view",
        <p>
          2. Left click on your army or the tile under it. You can push the{" "}
          <strong>
            <span className="border border-gold px-1">Esc</span>
          </strong>{" "}
          key to cancel the action.{" "}
        </p>,
        "3. Explore or travel with your army.",
      ],
      prizes: [{ id: QuestType.Travel, title: "Travel" }],
      depth: 5,
    },
  ],
  [
    QuestId.BuildWorkersHut,
    {
      name: "Build a workers hut",
      view: "REALM",
      description: `Each building takes up population in your realm. You realm starts with a population of ${configManager.getBasePopulationCapacity()}. 
      Build worker huts to extend your population capacity by ${
        configManager.getBuildingPopConfig(BuildingType.WorkersHut).capacity
      }.`,
      steps: [
        navigationStep(BuildingThumbs.construction),
        "2. Select the worker hut building",
        "3. Left click on a hex to build it, or right click to cancel",
      ],
      prizes: [{ id: QuestType.Population, title: "Population" }],
      depth: 6,
    },
  ],
  [
    QuestId.Market,
    {
      name: "Build a market",
      view: "REALM",
      description: (
        <div>
          <div className="mt-2">Build a market to produce donkeys. Donkeys are a resource used to transport goods.</div>{" "}
          <div className="flex flex-row mt-2">
            <ResourceIcon size="sm" resource={ResourcesIds[ResourcesIds.Donkey]} />
            <div> Donkeys can transport </div>
            {configManager.getCapacityConfig(CapacityConfigCategory.Donkey) / 1000} kg{" "}
          </div>
          <ResourceWeight className="mt-2" />
        </div>
      ),
      steps: [
        navigationStep(BuildingThumbs.construction),
        "2. Select the market building",
        "3. Left click on a hex to build it, or right click to cancel",
      ],
      prizes: [{ id: QuestType.Market, title: "Market" }],
      depth: 6,
    },
  ],
  [
    QuestId.Pillage,
    {
      name: "Pillage a structure",
      view: "WORLD",
      description:
        "Pillage a realm, hyperstructure or fragment mine. To pillage a structure, travel with your army to your target first, then pillage it.",
      steps: [
        "1. Go to world view",
        "2. Right click on your army",
        "3. Travel with your army to your target",
        "4. Pillage the structure",
      ],
      prizes: [{ id: QuestType.Pillage, title: "Pillage" }],
      depth: 6,
    },
  ],
  [
    QuestId.Mine,
    {
      name: "Claim a Fragment mine",
      view: "WORLD",
      description: "Explore the world, find Fragment mines and battle bandits for its ownership",
      steps: [
        "1. Go to world view",
        "2. Right click on your army",
        "3. Explore with your army to find Fragment mines",
        "4. Defeat the defending bandits or player to claim the mine",
      ],
      prizes: [{ id: QuestType.Mine, title: "Mine" }],
      depth: 6,
    },
  ],
  [
    QuestId.Contribution,
    {
      name: "Contribute to a hyperstructure",
      view: "",
      description: "Contribute to a Hyperstructure",
      steps: [
        navigationStep(BuildingThumbs.worldStructures),
        "2. Select a Hyperstructure",
        "4. Contribute to the Hyperstructure's construction",
      ],
      prizes: [{ id: QuestType.Contribution, title: "Contribution" }],
      depth: 6,
    },
  ],
  [
    QuestId.Hyperstructure,
    {
      name: "Build a hyperstructure",
      view: "WORLD",
      description: "Build a Hyperstructure",
      steps: [
        navigationStep(BuildingThumbs.construction),
        "2. Select the Hyperstructure building",
        "3. Left click on a hex to build it, or right click to cancel",
      ],
      prizes: [{ id: QuestType.Hyperstructure, title: "Hyperstructure" }],
      depth: 6,
    },
  ],
]);
