import { useDojo } from "@/hooks/context/DojoContext";
import { Tabs } from "@/ui/elements/tab";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";
import AddLiquidity from "./AddLiquidity";
import { LiquidityTable } from "./LiquidityTable";
import { ResourceSwap } from "./Swap";
import { ID } from "@bibliothecadao/eternum";

type BankListProps = {
  bankEntityId: ID;
  structureEntityId: ID;
};

export const BankPanel = ({ bankEntityId, structureEntityId }: BankListProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);

  const position = getComponentValue(Position, getEntityIdFromKeys([BigInt(bankEntityId)]));

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <ResourceSwap bankEntityId={bankEntityId} entityId={structureEntityId} />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Pools</div>
          </div>
        ),
        component: (
          <div>
            <AddLiquidity bank_entity_id={bankEntityId} entityId={structureEntityId!} />
          </div>
        ),
      },
    ],
    [structureEntityId, position],
  );

  const liquidityTable = useMemo(() => {
    return (
      <div className="mt-4 text-xs">
        <LiquidityTable bank_entity_id={bankEntityId} entity_id={structureEntityId} />
      </div>
    );
  }, [bankEntityId, structureEntityId]);

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
