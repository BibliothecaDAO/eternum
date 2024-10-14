import { useDojo } from "@/hooks/context/DojoContext";
import { EntityList } from "@/ui/components/list/EntityList";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { currencyIntlFormat, divideByPrecision } from "@/ui/utils/utils";
import { useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";

import { FragmentMinePanel } from "@/ui/components/fragmentMines/FragmentMinePanel";
import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";

import { useFragmentMines } from "@/hooks/helpers/useFragmentMines";
import { useHyperstructureProgress, useHyperstructures } from "@/hooks/helpers/useHyperstructures";

import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { QuestId } from "@/ui/components/quest/questDetails";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ContractAddress, findResourceById, ID, ResourcesIds } from "@bibliothecadao/eternum";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { hyperstructures } = useHyperstructures();
  const { fragmentMines } = useFragmentMines();

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

  const fragmentMineExtraContent = (entityId: any) => {
    const fragmentMine = fragmentMines.find((fragmentMine) => fragmentMine.entity_id === entityId);
    if (!fragmentMine) return null;

    fragmentMine.production_rate;

    return <FragmentMineExtraContent x={Number(fragmentMine.x!)} y={Number(fragmentMine.y!)} entityId={entityId!} />;
  };

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
            title="FragmentMines"
            panel={({ entity }) => <FragmentMinePanel entity={entity} />}
            entityContent={fragmentMineExtraContent}
            list={fragmentMines.map((fragmentMine) => ({
              id: fragmentMine.entity_id,
              ...fragmentMine,
            }))}
          />
        ),
      },
    ],
    [selectedTab, hyperstructures, fragmentMines],
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

  const progress = useHyperstructureProgress(hyperstructureEntityId);

  return (
    <div className="flex space-x-5 items-center text-xs">
      <ViewOnMapIcon className={"my-auto hover:scale-125 hover:grow"} position={{ x, y }} />
      <div>
        Progress: {`${progress.percentage}%`}
        <br />
        Shares:{" "}
        {currencyIntlFormat(
          (LeaderboardManager.instance().getAddressShares(ContractAddress(account.address), hyperstructureEntityId) ||
            0) * 100,
          0,
        )}
        %
      </div>
    </div>
  );
};

const FragmentMineExtraContent = ({ x, y, entityId }: { x: number; y: number; entityId: ID }) => {
  const { getBalance } = getResourceBalance();
  const dynamicResources = getBalance(entityId, ResourcesIds.AncientFragment);

  const trait = useMemo(() => findResourceById(ResourcesIds.AncientFragment)?.trait, []);

  return (
    <div className="flex space-x-5 items-center text-xs">
      <ViewOnMapIcon className={"my-auto  hover:scale-125 hover:grow"} position={{ x, y }} />
      <ResourceIcon
        className="self-center justify-center"
        isLabor={false}
        withTooltip={false}
        resource={trait || ""}
        size={"xs"}
      />{" "}
      {Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(divideByPrecision(dynamicResources.balance || 0))}{" "}
    </div>
  );
};
