import { RealmInfo as RealmInfoType, ResourcesIds } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { FC, useState } from "react";
import { BuildingsList } from "./components/buildings-list";
import { LaborProductionControls } from "./components/labor-production-controls";
import { RealmInfo } from "./components/realm-info";
import { ResourceProductionControls } from "./components/resource-production-controls";

interface ProductionBodyProps {
  realm: RealmInfoType;
}

export const ProductionBody: FC<ProductionBodyProps> = ({ realm }) => {
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);
  const [ticks, setTicks] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const {
    setup: {
      account: { account },
      systemCalls: { burn_other_predefined_resources_for_resources },
    },
  } = useDojo();

  const handleProduce = async () => {
    if (!selectedResource || !ticks) return;

    setIsLoading(true);

    try {
      await burn_other_predefined_resources_for_resources({
        from_entity_id: realm.entityId,
        produced_resource_types: [selectedResource],
        production_tick_counts: [ticks],
        signer: account,
      });

      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <RealmInfo level={realm.level} population={realm.population || 0} storage={realm.capacity || 0} />
      <BuildingsList realm={realm} onSelectProduction={setSelectedResource} selectedResource={selectedResource} />
      {selectedResource &&
        (selectedResource === ResourcesIds.Labor ? (
          <LaborProductionControls
            realm={realm}
            productionAmount={productionAmount}
            setProductionAmount={setProductionAmount}
            handleProduce={handleProduce}
            ticks={ticks}
            setTicks={setTicks}
            isLoading={isLoading}
          />
        ) : (
          <ResourceProductionControls
            selectedResource={selectedResource}
            useRawResources={useRawResources}
            setUseRawResources={setUseRawResources}
            productionAmount={productionAmount}
            setProductionAmount={setProductionAmount}
            handleProduce={handleProduce}
            realm={realm}
            ticks={ticks}
            setTicks={setTicks}
            isLoading={isLoading}
          />
        ))}
    </div>
  );
};
