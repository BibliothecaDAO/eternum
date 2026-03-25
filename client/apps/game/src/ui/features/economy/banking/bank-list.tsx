import { Tabs } from "@/ui/design-system/atoms";
import { AddLiquidity, LiquidityTable, Swap as ResourceSwap } from "@/ui/features/economy/banking";
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
        key: "swap",
        label: (
          <div className="flex relative group flex-col items-center">
            <div className="text-sm font-medium">Swap</div>
          </div>
        ),
        component: <ResourceSwap entityId={structureEntityId} listResourceId={selectedResource} />,
      },
      {
        key: "pools",
        label: (
          <div className="flex relative group flex-col items-center">
            <div className="text-sm font-medium">Pools</div>
          </div>
        ),
        component: (
          <div>
            <AddLiquidity entityId={structureEntityId!} listResourceId={selectedResource} />
          </div>
        ),
      },
    ],
    [structureEntityId, selectedResource],
  );

  return (
    <div className="amm-selector p-4 flex flex-col h-full">
      <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-auto">
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
      <div className="border-t border-gold/10 pt-4 mt-4 text-xs flex-1 overflow-y-auto">
        <LiquidityTable entity_id={structureEntityId} />
      </div>
    </div>
  );
};
