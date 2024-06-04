import { useMemo, useState } from "react";
import { useDojo } from "@/hooks/context/DojoContext";
import { Tabs } from "../../elements/tab";
import { EntityList } from "@/ui/components/list/EntityList";
import { ViewOnMapButton } from "@/ui/components/military/ArmyManagementCard";
import { currencyIntlFormat } from "@/ui/utils/utils";

import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { ShardMinePanel } from "@/ui/components/shardMines/ShardMinePanel";

import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { useShardMines } from "@/hooks/helpers/useShardMines";
import { useContributions } from "@/hooks/helpers/useContributions";

import { calculateShares } from "@/hooks/store/useLeaderBoardStore";

export const WorldStructuresMenu = ({}: any) => {
  const { hyperstructures } = useHyperstructures();
  const { shardMines } = useShardMines();

  const hyperstructureExtraContent = (entityId: any) => {
    const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === BigInt(entityId));
    if (!hyperstructure) return null;
    return (
      <HyperStructureExtraContent
        hyperstructureEntityId={hyperstructure.entity_id!}
        x={hyperstructure.x!}
        y={hyperstructure.y!}
      />
    );
  };

  const shardMineExtraContent = (entityId: any) => {
    const shardMine = shardMines.find((shardMine) => shardMine.entity_id === BigInt(entityId));
    if (!shardMine) return null;

    shardMine.production_rate;

    return (
      <ShardMineExtraContent
        shardMineEntityId={shardMine.entity_id!}
        x={shardMine.x!}
        y={shardMine.y!}
        balance={shardMine.balance!}
      />
    );
  };

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "Hyperstructures",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Hyperstructures</div>
          </div>
        ),
        component: (
          <EntityList
            title="Hyperstructures"
            panel={({ entity }) => <HyperstructurePanel entity={entity} />}
            entityContent={hyperstructureExtraContent}
            list={hyperstructures.map((hyperstructure) => ({
              id: hyperstructure.entity_id,
              ...hyperstructure,
            }))}
          />
        ),
      },
      {
        key: "Mines",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Mines</div>
          </div>
        ),
        component: (
          <EntityList
            title="ShardMines"
            panel={({ entity }) => <ShardMinePanel entity={entity} />}
            entityContent={shardMineExtraContent}
            list={shardMines.map((shardMine) => ({
              id: shardMine.entity_id,
              ...shardMine,
            }))}
          />
        ),
      },
    ],
    [selectedTab, hyperstructures, shardMines],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: number) => setSelectedTab(index)}
        variant="default"
        className=""
      >
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </>
  );
};

const HyperStructureExtraContent = ({
  hyperstructureEntityId,
  x,
  y,
}: {
  hyperstructureEntityId: bigint;
  x: number;
  y: number;
}) => {
  const { getContributionsByPlayerAddress } = useContributions();
  const { useProgress } = useHyperstructures();
  const progress = useProgress(hyperstructureEntityId);
  const playerContributions = getContributionsByPlayerAddress(
    BigInt(useDojo().account.account.address),
    hyperstructureEntityId,
  );

  return (
    <div className="flex space-x-5 items-center text-xs">
      <ViewOnMapButton
        position={{
          x: x,
          y: y,
        }}
      />
      <div>
        Progress: {`${progress.percentage}%`}
        <br />
        Shares: {currencyIntlFormat(calculateShares(playerContributions) * 100, 0)}%
      </div>
    </div>
  );
};

const ShardMineExtraContent = ({
  shardMineEntityId,
  x,
  y,
  balance,
}: {
  shardMineEntityId: bigint;
  x: number;
  y: number;
  balance: bigint;
}) => {
  return (
    <div className="flex space-x-5 items-center text-xs">
      <ViewOnMapButton
        position={{
          x: x,
          y: y,
        }}
      />
      <div>Balance: {Number(balance)}</div>
    </div>
  );
};
