import { configManager } from "@/dojo/setup";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useRealm } from "@/hooks/helpers/useRealms";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useBridgeAsset } from "@/hooks/useBridge";
import { useTravel } from "@/hooks/useTravel";
import { displayAddress, multiplyByPrecision } from "@/lib/utils";
import {
  ADMIN_BANK_ENTITY_ID,
  DONKEY_ENTITY_TYPE,
  RESOURCE_PRECISION,
  resources,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { TooltipContent, TooltipTrigger } from "@radix-ui/react-tooltip";
import { useAccount } from "@starknet-react/core";
import { InfoIcon, Loader, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SelectSingleResource } from "../ui/SelectResources";
import { Tooltip, TooltipProvider } from "../ui/tooltip";
import { calculateDonkeysNeeded, getSeasonAddresses, getTotalResourceWeight } from "../ui/utils/utils";
import { BridgeFees } from "./bridge-fees";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeOutStep1 = () => {
  const { address } = useAccount();

  const { getRealmNameById } = useRealm();
  const { computeTravelTime } = useTravel();
  const [isFeesOpen, setIsFeesOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [realmEntityId, setRealmEntityId] = useState<string>("");
  const { bridgeStartWithdrawFromRealm } = useBridgeAsset();
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const selectedResourceId = useMemo(() => selectedResourceIds[0] ?? 0, [selectedResourceIds]);
  const selectedResourceAmount = useMemo(
    () => selectedResourceAmounts[selectedResourceId] ?? 0,
    [selectedResourceAmounts, selectedResourceId],
  );

  const [resourceFees, setResourceFees] = useState<
    {
      velordsFee: string;
      seasonPoolFee: string;
      clientFee: string;
      bankFee: string;
      totalFee?: string;
    }[]
  >([]);

  /*const totalFeeOnWithdrawal = useMemo(
    () =>
      formatFee(
        Number(velordsFeeOnWithdrawal) +
          Number(seasonPoolFeeOnWithdrawal) +
          Number(clientFeeOnWithdrawal) +
          Number(bankFeeOnWithdrawal),
      ),
    [velordsFeeOnWithdrawal, seasonPoolFeeOnWithdrawal, clientFeeOnWithdrawal, bankFeeOnWithdrawal],
  );*/
  const { getBalance } = getResourceBalance();
  const donkeyBalance = useMemo(() => {
    if (realmEntityId) {
      return getBalance(Number(realmEntityId), ResourcesIds.Donkey);
    } else {
      return { balance: 0 };
    }
  }, [getBalance, realmEntityId]);

  const { playerRealms } = useEntities();
  const playerRealmsIdAndName = useMemo(() => {
    return playerRealms.map((realm) => ({
      realmId: realm!.realm_id,
      entityId: realm!.entity_id,
      name: getRealmNameById(realm!.realm_id),
    }));
  }, [playerRealms]);

  const travelTime = useMemo(() => {
    if (realmEntityId) {
      return computeTravelTime(
        Number(ADMIN_BANK_ENTITY_ID),
        Number(realmEntityId!),
        configManager.getSpeedConfig(DONKEY_ENTITY_TYPE),
        false,
      );
    } else {
      return 0;
    }
  }, [selectedResourceId, realmEntityId, selectedResourceAmount]);

  const travelTimeInHoursAndMinutes = (travelTime: number) => {
    const hours = Math.floor(travelTime / 60);
    const minutes = travelTime % 60;
    return `${hours}h ${minutes}m`;
  };

  const orderWeight = useMemo(() => {
    if (selectedResourceIds.length > 0) {
      const totalWeight = getTotalResourceWeight([
        { resourceId: selectedResourceId, amount: multiplyByPrecision(selectedResourceAmount) },
      ]);
      return totalWeight;
    } else {
      return 0;
    }
  }, [selectedResourceIds, selectedResourceAmounts]);

  const donkeysNeeded = useMemo(() => {
    if (orderWeight) {
      return calculateDonkeysNeeded(orderWeight);
    } else {
      return 0;
    }
  }, [orderWeight]);

  const onSendToBank = async () => {
    if (realmEntityId) {
      const resourceAddresses = await getSeasonAddresses();
      const selectedResourceName = ResourcesIds[selectedResourceId];

      const tokenAddress = resourceAddresses[selectedResourceName.toUpperCase() as keyof typeof resourceAddresses][1];
      try {
        setIsLoading(true);
        await bridgeStartWithdrawFromRealm(
          tokenAddress as string,
          ADMIN_BANK_ENTITY_ID,
          BigInt(realmEntityId!),
          BigInt(selectedResourceAmount * RESOURCE_PRECISION),
        );

        setSelectedResourceIds([]);
        setSelectedResourceAmounts({});
      } finally {
        setIsLoading(false);
      }
    } else {
      console.error("\n\n\n\n Realm does not exist in game yet. settle the realm!\n\n\n\n");
    }
  };

  return (
    <div className="max-w-md flex flex-col gap-3">
      <TypeP>
        Bridge resources from your Realms balance in game to tradeable ERC20 assets in your Starknet wallet. This will
        require a second step to send the resources to your wallet once the donkeys have arrived at the bank.
      </TypeP>
      <hr />
      <div className="flex justify-between">
        <div className="flex flex-col min-w-40">
          <div className="text-xs uppercase mb-1 ">From Realm</div>
          <Select onValueChange={(value) => setRealmEntityId(value)}>
            <SelectTrigger className="w-full border-gold/15">
              <SelectValue placeholder="Select Settled Realm" />
            </SelectTrigger>
            <SelectContent>
              {playerRealmsIdAndName.map((realm) => {
                return (
                  <SelectItem key={realm.realmId} value={realm.entityId.toString()}>
                    #{realm.realmId} - {realm.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs uppercase mb-1">To Wallet</div>
          <div>{displayAddress(address || "")}</div>
        </div>
      </div>

      {Boolean(realmEntityId) && (
        <SelectResourceRow
          realmEntityId={Number(realmEntityId)}
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={(value: number[]) => setSelectedResourceIds(value as unknown as never[])}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
        />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <div>Arrives in Bank</div>
          <div>{travelTimeInHoursAndMinutes(travelTime ?? 0)}</div>
        </div>
        <div className="flex justify-between">
          <div>
            Donkeys Burnt
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="ml-2 w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent className="bg-background border rounded p-2 max-w-56">
                  Donkeys are required to transport the resources to the bank
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            {donkeysNeeded} / {donkeyBalance.balance} <ResourceIcon resource={"Donkey"} size="md" />
          </div>
        </div>
        <BridgeFees
          isOpen={isFeesOpen}
          onOpenChange={setIsFeesOpen}
          resourceSelections={selectedResourceAmounts}
          setResourceFees={setResourceFees}
          type="withdrawal"
        />
        <div className="flex justify-between font-bold mt-5 mb-5">
          <div>Total Amount Received</div>
          <div>{formatFee(Number(selectedResourceAmount) /*- Number(totalFeeOnWithdrawal))*/)}</div>
        </div>
      </div>
      <Button
        disabled={(!selectedResourceAmount && !selectedResourceId && !realmEntityId) || isLoading}
        onClick={() => onSendToBank()}
      >
        {isLoading && <Loader className="animate-spin pr-2" />}
        {isLoading ? "Sending to Bank..." : !realmEntityId ? "Select a Realm" : "Send to Bank (Step 1)"}
      </Button>
    </div>
  );
};

export const SelectResourceRow = ({
  realmEntityId,
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
}: {
  realmEntityId: number;
  selectedResourceIds: number[];
  setSelectedResourceIds: (value: number[]) => void;
  selectedResourceAmounts: { [key: string]: number };
  setSelectedResourceAmounts: (value: { [key: string]: number }) => void;
}) => {
  const unselectedResources = useMemo(
    () => resources.filter((res) => !selectedResourceIds.includes(res.id)),
    [selectedResourceIds],
  );
  const addResourceGive = () => {
    setSelectedResourceIds([...selectedResourceIds, unselectedResources[0].id]);
    setSelectedResourceAmounts({
      ...selectedResourceAmounts,
      [unselectedResources[0].id]: 1,
    });
  };

  return (
    <div className="grid grid-cols-0 gap-8 h-full">
      <div className=" bg-gold/10  h-auto border border-gold/40 flex flex-col items-center">
        <SelectSingleResource
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={setSelectedResourceIds}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
          entity_id={realmEntityId}
        />
        <Button variant="default" className="mb-4" size="default" onClick={addResourceGive}>
          <Plus />
        </Button>
      </div>
    </div>
  );
};
