import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { ResourceSwap } from "./Swap";
import { useEntities } from "@/hooks/helpers/useEntities";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "@/hooks/context/DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { LiquidityTable } from "./LiquidityTable";
import AddLiquidity from "./AddLiquidity";
import { hexToAscii, numberToHex } from "@/ui/utils/utils";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";

type BankListProps = {
  entity: any;
};

export const BankPanel = ({ entity }: BankListProps) => {
  const {
    setup: {
      components: { Position, Bank, Owner, AddressName },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);

  const { playerRealms } = useEntities();

  const realmEntityId = playerRealms()[0].entity_id!;
  const bank = getComponentValue(Bank, getEntityIdFromKeys([entity.id]));
  const owner = getComponentValue(Owner, getEntityIdFromKeys([entity.id]));
  const ownerName = owner ? getComponentValue(AddressName, getEntityIdFromKeys([owner.address]))?.name : undefined;
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
          <div>
            <div className="w-1/2 mx-auto mb-8">
              <AddLiquidity bank_entity_id={entity.id} entityId={realmEntityId!} />
            </div>
            <LiquidityTable bank_entity_id={entity.id} entity_id={realmEntityId} />
          </div>
        ),
      },
    ],
    [realmEntityId, position],
  );

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
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </div>
  );
};
