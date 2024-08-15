import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Tabs } from "@/ui/elements/tab";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";
import AddLiquidity from "./AddLiquidity";
import { LiquidityTable } from "./LiquidityTable";
import { ResourceSwap } from "./Swap";
import { ID } from "@bibliothecadao/eternum";

type BankListProps = {
  entityId: ID;
};

export const BankPanel = ({ entityId }: BankListProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);

  const { playerRealms } = useEntities();

  const realmEntityId = playerRealms()[0].entity_id!;
  const position = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityId)]));

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <ResourceSwap bankEntityId={entityId} entityId={realmEntityId} />,
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
            <AddLiquidity bank_entity_id={entityId} entityId={realmEntityId!} />
          </div>
        ),
      },
    ],
    [realmEntityId, position],
  );

  const liquidityTable = useMemo(() => {
    return (
      <div className="mt-4">
        <LiquidityTable bank_entity_id={entityId} entity_id={realmEntityId} />
      </div>
    );
  }, [entityId, realmEntityId]);

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
