import { Tabs } from "@/ui/design-system/atoms";
import AddLiquidity from "@/ui/features/economy/banking/add-liquidity";
import { LiquidityTable } from "@/ui/features/economy/banking/liquidity-table";
import { ResourceSwap } from "@/ui/features/economy/banking/swap";
import { ID } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

type BankListProps = {
  structureEntityId: ID;
  selectedResource: number;
};

export const BankPanel = ({ structureEntityId, selectedResource }: BankListProps) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <ResourceSwap entityId={structureEntityId} listResourceId={selectedResource} />,
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
            <AddLiquidity entityId={structureEntityId!} listResourceId={selectedResource} />
          </div>
        ),
      },
    ],
    [structureEntityId],
  );

  const liquidityTable = useMemo(() => {
    return (
      <div className="mt-4 text-xs">
        <LiquidityTable entity_id={structureEntityId} />
      </div>
    );
  }, [structureEntityId]);

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
