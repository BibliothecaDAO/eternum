import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { ResourceSwap } from "./Swap";
import { OpenBankAccount } from "./OpenBankAccount";
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
import { LiquidityTable } from "./LiquidityTable";
import AddLiquidity from "./AddLiquidity";

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
  const { useMyAccountsInBank } = useBanks();

  const { playerRealms } = useEntities();

  const myBankAccountsEntityIds = useMyAccountsInBank(entity.id);
  const myBankAccountEntityId = myBankAccountsEntityIds.length === 1 ? myBankAccountsEntityIds[0] : undefined;

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
        component: <ResourceSwap bankEntityId={entity.id} entityId={myBankAccountEntityId!} />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>My Account</div>
          </div>
        ),
        component: !myBankAccountEntityId ? (
          <OpenBankAccount bank_entity_id={entity.id} />
        ) : (
          <BankEntityList entity={{ id: myBankAccountEntityId }} />
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
          <>
            <AddLiquidity bank_entity_id={entity.id} entityId={myBankAccountEntityId!} />
            <LiquidityTable bank_entity_id={entity.id} bank_account_entity_id={myBankAccountEntityId} />
          </>
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
            title="Send"
            panel={({ entity }) => (
              <SendResourcesPanel
                senderEntityId={entity.entity_id}
                position={position}
                onSendCaravan={() => setSelectedTab(4)}
              />
            )}
          />
        ),
      },

      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Withdraw Resources</div>
          </div>
        ),
        component: (
          <EntityList
            list={playerRealms()}
            title="Witdraw"
            panel={({ entity }) => (
              <SendResourcesPanel
                senderEntityId={myBankAccountEntityId!}
                position={getComponentValue(Position, getEntityIdFromKeys([entity.entity_id]))}
                onSendCaravan={() => setSelectedTab(1)}
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
    [myBankAccountsEntityIds, position],
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
