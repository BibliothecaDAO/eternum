import { configManager } from "@/dojo/setup";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useRealm } from "@/hooks/helpers/useRealms";
import { useBridgeAsset } from "@/hooks/useBridge";
import { useTravel } from "@/hooks/useTravel";
import { displayAddress } from "@/lib/utils";
import {
  ADMIN_BANK_ENTITY_ID,
  BRIDGE_FEE_DENOMINATOR,
  DONKEY_ENTITY_TYPE,
  EternumGlobalConfig,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useAccount } from "@starknet-react/core";
import { Loader, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SelectSingleResource } from "../ui/SelectResources";
import { calculateDonkeysNeeded, getSeasonAddresses, getTotalResourceWeight } from "../ui/utils/utils";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeOutStep1 = () => {
  const { address } = useAccount();

  const { getRealmNameById } = useRealm();
  const { computeTravelTime } = useTravel();

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

  const bridgeConfig = EternumGlobalConfig.bridge;

  const calculateBridgeFee = (percent: number) => {
    return (percent * Number(selectedResourceAmount)) / BRIDGE_FEE_DENOMINATOR;
  };

  const calculateBridgeFeeDisplayPercent = (percent: number) => {
    return (percent * 100) / BRIDGE_FEE_DENOMINATOR;
  };

  const velordsFeeOnWithdrawal = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.velords_fee_on_wtdr_percent)),
    [selectedResourceAmount],
  );
  const seasonPoolFeeOnWithdrawal = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.season_pool_fee_on_wtdr_percent)),
    [selectedResourceAmount],
  );
  const clientFeeOnWithdrawal = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.client_fee_on_wtdr_percent)),
    [selectedResourceAmount],
  );
  const bankFeeOnWithdrawal = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.max_bank_fee_dpt_percent)),
    [selectedResourceAmount],
  );

  const totalFeeOnWithdrawal = useMemo(
    () =>
      formatFee(
        Number(velordsFeeOnWithdrawal) +
          Number(seasonPoolFeeOnWithdrawal) +
          Number(clientFeeOnWithdrawal) +
          Number(bankFeeOnWithdrawal),
      ),
    [velordsFeeOnWithdrawal, seasonPoolFeeOnWithdrawal, clientFeeOnWithdrawal, bankFeeOnWithdrawal],
  );

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
      const totalWeight = getTotalResourceWeight([{ resourceId: selectedResourceId, amount: selectedResourceAmount }]);
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
          <div>Donkeys Needed</div>
          <div>{donkeysNeeded}</div>
        </div>
        <hr />
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button className="w-full flex justify-between font-bold px-0" variant={"ghost"}>
              <div className="flex items-center">
                <Plus className="mr-4" />
                Total Transfer Fee
              </div>
              <div>{totalFeeOnWithdrawal}</div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <div>Bank Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.max_bank_fee_wtdr_percent)}%)</div>
              <div>{bankFeeOnWithdrawal}</div>
            </div>
            <div className="flex justify-between text-xs">
              <div>Velords Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.velords_fee_on_wtdr_percent)}%)</div>
              <div>{velordsFeeOnWithdrawal}</div>
            </div>
            <div className="flex justify-between text-xs">
              <div>
                Season Pool Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.season_pool_fee_on_wtdr_percent)}%)
              </div>
              <div>{seasonPoolFeeOnWithdrawal}</div>
            </div>
            <div className="flex justify-between text-xs">
              <div>Client Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.client_fee_on_wtdr_percent)}%)</div>
              <div>{clientFeeOnWithdrawal}</div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex justify-between font-bold mt-5 mb-5">
          <div>Total Amount Received</div>
          <div>{formatFee(Number(selectedResourceAmount) - Number(totalFeeOnWithdrawal))}</div>
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
  return (
    <div className="grid grid-cols-0 gap-8 h-full">
      <div className=" bg-gold/10  h-auto border border-gold/40">
        <SelectSingleResource
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={setSelectedResourceIds}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
          entity_id={realmEntityId}
        />
      </div>
    </div>
  );
};
