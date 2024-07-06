import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Tabs } from "@/ui/elements/tab";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";
import AddLiquidity from "./AddLiquidity";
import { LiquidityTable } from "./LiquidityTable";
import { ResourceSwap } from "./Swap";

type BankListProps = {
  entity: any;
};

export const BankPanel = ({ entity }: BankListProps) => {
  const {
    setup: {
      components: { Position, Owner },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);

  const { playerRealms } = useEntities();

  const realmEntityId = playerRealms()[0].entity_id!;
  const owner = getComponentValue(Owner, getEntityIdFromKeys([entity.id]));
  const position = getComponentValue(Position, getEntityIdFromKeys([entity.id]));

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <ResourceSwap bankEntityId={entity.id} entityId={realmEntityId} />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Pools</div>
          </div>
        ),
        component: (
          <div className="w-1/2 mx-auto">
            <AddLiquidity bank_entity_id={entity.id} entityId={realmEntityId!} />
          </div>
        ),
      },
    ],
    [realmEntityId, position],
  );

  const liquidityTable = useMemo(() => {
    return (
      <div className="mt-4">
        <LiquidityTable bank_entity_id={entity.id} entity_id={realmEntityId} />
      </div>
    );
  }, [entity.id, realmEntityId]);

  return (
    <div className="m-4">
      <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index} className="h-full">
              {tab.component}
            </Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
      {liquidityTable}
    </div>
  );
};
