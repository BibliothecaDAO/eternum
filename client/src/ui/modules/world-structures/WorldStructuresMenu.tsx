import { useDojo } from "@/hooks/context/DojoContext";
import { EntityList } from "@/ui/components/list/EntityList";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";

import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { ShardMinePanel } from "@/ui/components/shardMines/ShardMinePanel";

import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { useShardMines } from "@/hooks/helpers/useShardMines";

import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { QuestId } from "@/ui/components/quest/questDetails";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ContractAddress, ID } from "@bibliothecadao/eternum";

export const WorldStructuresMenu = ({}: any) => {
  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { hyperstructures } = useHyperstructures();
  const { shardMines } = useShardMines();

  const hyperstructureExtraContent = (entityId: any) => {
    const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === entityId);
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
    const shardMine = shardMines.find((shardMine) => shardMine.entity_id === entityId);
    if (!shardMine) return null;

    shardMine.production_rate;

    return <ShardMineExtraContent x={Number(shardMine.x!)} y={Number(shardMine.y!)} balance={shardMine.balance!} />;
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
            questing={selectedQuest?.id === QuestId.Contribution}
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
      <HintModalButton className="absolute top-1 right-1" section={HintSection.WorldStructures} />
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
  hyperstructureEntityId: ID;
  x: number;
  y: number;
}) => {
  const {
    account: { account },
  } = useDojo();
  const { useProgress } = useHyperstructures();
  const progress = useProgress(hyperstructureEntityId);

  return (
    <div className="flex space-x-5 items-center text-xs">
      <ViewOnMapIcon className={"my-auto hover:scale-125 hover:grow"} position={{ x, y }} />
      <div>
        Progress: {`${progress.percentage}%`}
        <br />
        Shares:{" "}
        {currencyIntlFormat(
          (LeaderboardManager.instance().getShares(ContractAddress(account.address), hyperstructureEntityId) || 0) *
            100,
          0,
        )}
        %
      </div>
    </div>
  );
};

const ShardMineExtraContent = ({ x, y, balance }: { x: number; y: number; balance: bigint }) => {
  return (
    <div className="flex space-x-5 items-center text-xs">
      <ViewOnMapIcon className={"my-auto  hover:scale-125 hover:grow"} position={{ x, y }} />
      <div>Balance: {Number(balance)}</div>
    </div>
  );
};
