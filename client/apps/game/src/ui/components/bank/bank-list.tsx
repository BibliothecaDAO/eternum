import AddLiquidity from "@/ui/components/bank/add-liquidity";
import { LiquidityTable } from "@/ui/components/bank/liquidity-table";
import { ResourceSwap } from "@/ui/components/bank/swap";
import { Tabs } from "@/ui/elements/tab";
import { ID } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";

type BankListProps = {
  bankEntityId: ID;
  structureEntityId: ID;
  selectedResource: number;
};

export const BankPanel = ({ bankEntityId, structureEntityId, selectedResource }: BankListProps) => {
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
        component: (
          <ResourceSwap bankEntityId={bankEntityId} entityId={structureEntityId} listResourceId={selectedResource} />
        ),
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
            <AddLiquidity bankEntityId={bankEntityId} entityId={structureEntityId!} listResourceId={selectedResource} />
          </div>
        ),
      },
    ],
    [structureEntityId, position],
  );

  const liquidityTable = useMemo(() => {
    return (
      <div className="mt-4 text-xs">
        <LiquidityTable bankEntityId={bankEntityId} entity_id={structureEntityId} />
      </div>
    );
  }, [bankEntityId, structureEntityId]);

  return (
    <div className="amm-selector m-4">
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
