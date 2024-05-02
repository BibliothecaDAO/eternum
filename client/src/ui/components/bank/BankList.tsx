import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { ResourceSwap } from "./Swap";
import { OpenBankAccount } from "./OpenBankAccount";
import { BankEntityList } from "./BankEntityList";
import { EntityList } from "../list/EntityList";
import { useBanks } from "@/hooks/helpers/useBanks";
import { useEntities } from "@/hooks/helpers/useEntities";
import { SendResourcesPanel } from "@/ui/components/trading/SendResourcesPanel";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "@/hooks/context/DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { EntitiesOnPositionList } from "../entities/EntitiesOnPositionList";
import { LiquidityTable } from "./LiquidityTable";
import AddLiquidity from "./AddLiquidity";
import { hexToAscii, numberToHex } from "@/ui/utils/utils";
import { ResourceArrivals } from "../trading/ResourceArrivals";
import { TransferBetweenEntities } from "../trading/TransferBetweenEntities";

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
  const { useMyAccountsInBank } = useBanks();

  const { playerRealms, playerAccounts } = useEntities();

  const myBankAccountsEntityIds = useMyAccountsInBank(entity.id);
  const myBankAccountEntityId = myBankAccountsEntityIds.length === 1 ? myBankAccountsEntityIds[0] : undefined;

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
        component: !myBankAccountEntityId ? (
          <OpenBankAccount bank_entity_id={entity.id} />
        ) : (
          <ResourceSwap bankEntityId={entity.id} entityId={myBankAccountEntityId!} />
        ),
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>My Account</div>
          </div>
        ),
        component: <BankEntityList entity={{ id: myBankAccountEntityId }} />,
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
        key: "transfer",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Transfer</div>
          </div>
        ),
        component: <TransferBetweenEntities entities={[...playerRealms(), ...playerAccounts()]} />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Arrivals</div>
          </div>
        ),
        component: <ResourceArrivals entityId={myBankAccountEntityId!} />,
      },
    ],
    [myBankAccountsEntityIds, position],
  );

  return (
    <div>
      <div className="flex justify-between">
        <h3>{entity.name}</h3>

        <div className="mr-3">
          <div>
            Banker:{" "}
            {ownerName ? hexToAscii(numberToHex(Number(ownerName))) : numberToHex(Number(owner!.address)).slice(0, 5)}
          </div>
          {bank && <div>{`Owner fees: ${(Number(bank.owner_fee_scaled) / 2 ** 64) * 100}%`}</div>}
          <div>LP fees: 5%</div>
        </div>
      </div>

      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => (!myBankAccountEntityId ? setSelectedTab(0) : setSelectedTab(index))}
        className="h-full"
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
    </div>
  );
};
