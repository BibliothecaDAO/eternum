import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { ResourceSwap } from "./Swap";

import { BankEntityList } from "./BankEntityList";
import { EntityList } from "../list/EntityList";
import { useBanks } from "@/hooks/helpers/useBanks";
import { useEntities } from "@/hooks/helpers/useEntities";
import { SendResourcesPanel } from "../worldmap/hyperstructures/SendResourcesPanel";
import { Position } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "@/hooks/context/DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { EntitiesOnPositionList } from "../entities/EntitiesOnPositionList";

type BankListProps = {
  entity: any;
  position: Position;
};

export const BankPanel = ({ entity }: BankListProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);
  const { getMyAccountsInBank } = useBanks();

  const { playerRealms } = useEntities();

  const myBankAccountsIds = getMyAccountsInBank(entity.id);

  const position = getComponentValue(Position, getEntityIdFromKeys([entity.id]));

  const myBankAccountList = myBankAccountsIds.map((id) => {
    return {
      id,
      name: `Bank Account ${id}`,
    };
  });

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <ResourceSwap />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>My Account</div>
          </div>
        ),
        component: (
          <EntityList
            title="Banks"
            panel={({ entity }) => <BankEntityList entity={entity} />}
            list={myBankAccountList}
          />
        ),
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Send Resources</div>
          </div>
        ),
        component: (
          <EntityList
            list={playerRealms()}
            title="armies"
            panel={({ entity }) => (
              <SendResourcesPanel
                senderEntityId={entity.entity_id}
                position={position}
                onSendCaravan={() => setSelectedTab(3)}
              />
            )}
          />
        ),
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Entities</div>
          </div>
        ),
        component: <EntitiesOnPositionList position={position} />,
      },
    ],
    [selectedTab, position],
  );

  return (
    <div>
      <div className="flex justify-between">
        <h3>{entity.name}</h3>

        <div>Banker: 0x..420</div>
      </div>

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
