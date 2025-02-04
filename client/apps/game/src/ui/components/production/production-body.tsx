import { ResourceChip } from "@/ui/components/resources/resource-chip";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import {
  BuildingType,
  configManager,
  divideByPrecision,
  getEntityIdFromKeys,
  ID,
  RealmInfo as RealmInfoType,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";

interface ProductionBodyProps {
  realmEntityId: ID;
}

const RealmInfo = ({
  level = 1,
  population = 100,
  storage = 1000,
}: {
  level: number;
  population: number;
  storage: number;
}) => (
  <div className="bg-brown/20 p-4 rounded-lg">
    <h3 className="text-2xl font-bold mb-2">Realm Info</h3>
    <div className="grid grid-cols-4 gap-4">
      <div>
        <span className="text-gold/80">Level:</span>
        <span className="ml-2">{level}</span>
      </div>
      <div>
        <span className="text-gold/80">Population:</span>
        <span className="ml-2">{population}</span>
      </div>
      <div>
        <span className="text-gold/80">Storage:</span>
        <span className="ml-2">{storage}</span>
      </div>
    </div>
  </div>
);

const BuildingsList = ({
  realm,
  onSelectProduction,
  selectedResource,
}: {
  realm: RealmInfoType;
  onSelectProduction: (resource: number) => void;
  selectedResource: number | null;
}) => {
  const buildings = useBuildings(realm.position.x, realm.position.y);

  const productionBuildings = buildings.filter(
    (building) =>
      building.category === BuildingType[BuildingType.Resource] ||
      building.category === BuildingType[BuildingType.Farm] ||
      building.category === BuildingType[BuildingType.FishingVillage] ||
      building.category === BuildingType[BuildingType.Barracks] ||
      building.category === BuildingType[BuildingType.ArcheryRange] ||
      building.category === BuildingType[BuildingType.Castle] ||
      building.category === BuildingType[BuildingType.Market] ||
      building.category === BuildingType[BuildingType.Stable],
  );

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const producedResources = Array.from(new Set(productionBuildings.map((building) => building.produced.resource)));

  const productions = useMemo(() => {
    return producedResources
      .map((resourceId) => {
        const resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(realm.entityId), BigInt(resourceId)]));

        const buildingsForResource = productionBuildings.filter(
          (building) => building.produced.resource === resourceId,
        );

        if (!resource?.production) return null;

        return {
          resource: resourceId,
          balance: resource?.balance || 0,
          production: resource.production,
          buildings: buildingsForResource,
        };
      })
      .filter((production) => production !== null);
  }, [producedResources]);

  console.log({ productions });

  return (
    <div className="bg-dark-brown/90 backdrop-blur-sm p-6 rounded-xl border border-gold/20 shadow-lg h-[400px] overflow-y-auto">
      <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4">Production Buildings</h3>
      <div className="space-y-4 min-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {/* TODO: fix bg image to the production buildings */}
        {productions.map((production) => {
          const bgImage = production.buildings[0]?.category
            ? BUILDING_IMAGES_PATH[
                BuildingType[
                  production.buildings[0].category as keyof typeof BuildingType
                ] as keyof typeof BUILDING_IMAGES_PATH
              ]
            : "";

          return (
            <div
              key={production.resource}
              onClick={() => onSelectProduction(production.resource)}
              className={`relative group cursor-pointer transition-all duration-200 border-2
                ${selectedResource === production.resource ? "border-gold/30" : "border-transparent"} 
                rounded-lg p-4`}
              style={{
                backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.9), rgba(20, 16, 13, 0.9)), url(${bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex items-start justify-between space-x-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <ResourceIcon resource={ResourcesIds[production.resource]} size="lg" />
                    <div>
                      <h4 className="text-lg font-semibold text-gold">{ResourcesIds[production.resource]}</h4>
                      <span className="text-sm text-gold/60">
                        {production.buildings.length} building{production.buildings.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-[280px] flex-shrink-0">
                  <ResourceChip
                    resourceId={production.resource}
                    entityId={realm.entityId}
                    maxStorehouseCapacityKg={realm.capacity || 0}
                    tick={0}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProductionControls = ({
  selectedResource,
  useRawResources,
  setUseRawResources,
  productionAmount,
  setProductionAmount,
  handleProduce,
  realm,
}: {
  selectedResource: number | null;
  useRawResources: boolean;
  setUseRawResources: (value: boolean) => void;
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  handleProduce: () => void;
  realm: RealmInfoType;
}) => {
  if (!selectedResource) {
    return (
      <div className="bg-brown/20 p-4 rounded-lg">
        <h3 className="text-2xl font-bold mb-4">Start Production</h3>
        <p className="text-brown-light">Select a building to start production</p>
      </div>
    );
  }

  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const inputResources = useMemo(() => {
    return configManager.resourceInputs[selectedResource];
  }, [selectedResource]);

  const resourceBalances = useMemo(() => {
    if (!selectedResource || !inputResources) return {};

    const balances: Record<number, number> = {};
    [...inputResources, { resource: selectedResource, amount: 1 }].forEach((resource) => {
      const value = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realm.entityId), BigInt(resource.resource)]),
      );
      balances[resource.resource] = divideByPrecision(Number(value?.balance || 0));
    });
    return balances;
  }, [selectedResource, inputResources, Resource, realm.entityId]);

  console.log({ resourceBalances });

  const handleInputChange = (value: number, inputResource: number) => {
    if (!inputResources) return;

    // Find the ratio between the old and new amounts for the changed resource
    const resourceConfig = inputResources.find((r) => r.resource === inputResource);
    if (!resourceConfig) return;

    // Calculate the new amount for the changed resource
    const newAmount = value / resourceConfig.amount;
    setProductionAmount(newAmount);
  };

  const calculateMaxProduction = () => {
    if (!inputResources || !resourceBalances) return 1;

    // Calculate how many items we can produce based on each input resource
    const maxAmounts = inputResources.map((input) => {
      const balance = resourceBalances[input.resource] || 0;
      return Math.floor(balance / input.amount);
    });

    // Return the minimum (limiting resource)
    return Math.max(1, Math.min(...maxAmounts));
  };

  const handleMaxClick = () => {
    setProductionAmount(calculateMaxProduction());
  };

  const isOverBalance = useMemo(() => {
    if (!inputResources || !resourceBalances) return false;

    return inputResources.some((input) => {
      const required = input.amount * productionAmount;
      const balance = resourceBalances[input.resource] || 0;
      return required > balance;
    });
  }, [inputResources, resourceBalances, productionAmount]);

  return (
    <div className="bg-brown/20 p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Start Production - {ResourcesIds[selectedResource]}</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Raw Resources */}
        <div
          className={`p-4 rounded-lg border-2 cursor-pointer ${
            useRawResources ? "border-gold" : "border-transparent opacity-50"
          }`}
          onClick={() => setUseRawResources(true)}
        >
          <h4 className="text-xl mb-2">Raw Resources</h4>
          <div className="space-y-2">
            {inputResources?.map((input) => {
              const balance = resourceBalances[input.resource] || 0;
              console.log({ balance });
              return (
                <div
                  key={input.resource}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors"
                >
                  <ResourceIcon resource={ResourcesIds[input.resource]} size="sm" />
                  <div className="flex items-center justify-between w-full">
                    <div className="w-2/3">
                      <NumberInput
                        value={input.amount * productionAmount}
                        onChange={(value) => handleInputChange(value, input.resource)}
                        min={0}
                        max={resourceBalances[input.resource] || 0}
                        className="rounded-md border-gold/30 hover:border-gold/50"
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        resourceBalances[input.resource] < input.amount * productionAmount
                          ? "text-order-giants"
                          : "text-gold/60"
                      }`}
                    >
                      {balance}
                    </span>
                  </div>
                </div>
              );
            })}
            <button
              onClick={handleMaxClick}
              className="mt-2 px-3 py-1 text-sm bg-gold/20 hover:bg-gold/30 text-gold rounded"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Labor Costs */}
        <div
          className={`p-4 rounded-lg border-2 cursor-pointer ${
            !useRawResources ? "border-gold" : "border-transparent opacity-50"
          }`}
          onClick={() => setUseRawResources(false)}
        >
          <h4 className="text-xl mb-2">Labor</h4>
          <div className="space-y-2">{/* Add labor inputs */}</div>
        </div>
      </div>

      {/* Output */}
      <div className="mb-4">
        <h4 className="text-xl mb-2">Output</h4>
        <div className="flex items-center gap-2">
          <ResourceIcon resource={ResourcesIds[selectedResource]} size="sm" />
          <NumberInput value={productionAmount} onChange={(value) => setProductionAmount(value)} min={1} />
          <span className="text-sm text-gold/60">
            → {productionAmount} {ResourcesIds[selectedResource]}
          </span>
          <span className="ml-2">Time: 2:30</span>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleProduce} disabled={isOverBalance} variant="primary">
          Start Production
        </Button>
      </div>
    </div>
  );
};

export const ProductionBody = ({ realm }: { realm: RealmInfoType }) => {
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);

  const handleProduce = () => {
    if (!selectedResource) return;

    console.log({
      resource: ResourcesIds[selectedResource],
      type: useRawResources ? "raw" : "labor",
      amount: productionAmount,
    });
  };

  return (
    <div className="space-y-4">
      <RealmInfo level={realm.level} population={realm.population || 0} storage={realm.capacity || 0} />
      <BuildingsList realm={realm} onSelectProduction={setSelectedResource} selectedResource={selectedResource} />
      <ProductionControls
        selectedResource={selectedResource}
        useRawResources={useRawResources}
        setUseRawResources={setUseRawResources}
        productionAmount={productionAmount}
        setProductionAmount={setProductionAmount}
        handleProduce={handleProduce}
        realm={realm}
      />
    </div>
  );
};
