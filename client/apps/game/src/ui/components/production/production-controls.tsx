import { configManager, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { LaborProductionControls } from "./labor-production-controls";
import { ResourceProductionControls } from "./resource-production-controls";

export const ProductionControls = ({ selectedResource, realm }: { selectedResource: number; realm: RealmInfo }) => {
  const {
    setup: {
      components: { ProductionWonderBonus },
    },
  } = useDojo();

  const isLaborMode = selectedResource === ResourcesIds.Labor;

  const [useRawResources, setUseRawResources] = useState(true);
  const [productionAmount, setProductionAmount] = useState(1);
  const [ticks, setTicks] = useState<number | undefined>();

  const bonus = useMemo(() => {
    const productionWonderBonus = getComponentValue(
      ProductionWonderBonus,
      getEntityIdFromKeys([BigInt(realm.entityId)]),
    );
    const wonderBonusConfig = configManager.getWonderBonusConfig();
    const hasActivatedWonderBonus = !!productionWonderBonus;
    return hasActivatedWonderBonus ? 1 + wonderBonusConfig.bonusPercentNum / 10000 : 1;
  }, [realm.entityId]);

  if (isLaborMode) {
    return <LaborProductionControls realm={realm} />;
  }

  return (
    <ResourceProductionControls
      selectedResource={selectedResource}
      useRawResources={useRawResources}
      setUseRawResources={setUseRawResources}
      productionAmount={productionAmount}
      setProductionAmount={setProductionAmount}
      realm={realm}
      ticks={ticks}
      setTicks={setTicks}
      bonus={bonus}
    />
  );
};
