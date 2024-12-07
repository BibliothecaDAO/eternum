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
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useAccount } from "@starknet-react/core";
import { Loader, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { calculateDonkeysNeeded, getSeasonAddresses, getTotalResourceWeight } from "../ui/utils/utils";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeIn = () => {
  const { account, address } = useAccount();

  const { computeTravelTime } = useTravel();
  const { getRealmNameById } = useRealm();

  const [selectedResourceContract, setselectedResourceContract] = useState("");
  const [selectedResourceAmount, setselectedResourceAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [realmEntityId, setRealmEntityId] = useState<string>("");

  const bridgeConfig = EternumGlobalConfig.bridge;

  const calculateBridgeFee = (percent: number) => {
    return (percent * Number(selectedResourceAmount)) / BRIDGE_FEE_DENOMINATOR;
  };

  const calculateBridgeFeeDisplayPercent = (percent: number) => {
    return (percent * 100) / BRIDGE_FEE_DENOMINATOR;
  };

  const velordsFeeOnDeposit = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.velords_fee_on_dpt_percent)),
    [selectedResourceAmount],
  );
  const seasonPoolFeeOnDeposit = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.season_pool_fee_on_dpt_percent)),
    [selectedResourceAmount],
  );
  const clientFeeOnDeposit = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.client_fee_on_dpt_percent)),
    [selectedResourceAmount],
  );
  const bankFeeOnDeposit = useMemo(
    () => formatFee(calculateBridgeFee(bridgeConfig.max_bank_fee_dpt_percent)),
    [selectedResourceAmount],
  );

  const totalFeeOnDeposit = useMemo(
    () =>
      formatFee(
        Number(velordsFeeOnDeposit) +
          Number(seasonPoolFeeOnDeposit) +
          Number(clientFeeOnDeposit) +
          Number(bankFeeOnDeposit),
      ),
    [velordsFeeOnDeposit, seasonPoolFeeOnDeposit, clientFeeOnDeposit, bankFeeOnDeposit],
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
        true,
      );
    } else {
      return 0;
    }
  }, [selectedResourceContract, realmEntityId, selectedResourceAmount]);

  const travelTimeInHoursAndMinutes = (travelTime: number) => {
    const hours = Math.floor(travelTime / 60);
    const minutes = travelTime % 60;
    return `${hours}h ${minutes}m`;
  };

  const orderWeight = useMemo(() => {
    if (selectedResourceContract && selectedResourceAmount) {
      const totalWeight = getTotalResourceWeight([
        {
          resourceId: ResourcesIds[selectedResourceContract as keyof typeof ResourcesIds],
          amount: Number(selectedResourceAmount),
        },
      ]);
      return totalWeight;
    } else {
      return 0;
    }
  }, [selectedResourceContract, selectedResourceAmount]);

  const donkeysNeeded = useMemo(() => {
    if (orderWeight) {
      return calculateDonkeysNeeded(orderWeight);
    } else {
      return 0;
    }
  }, [orderWeight]);

  const { bridgeIntoRealm } = useBridgeAsset();

  const onBridgeIntoRealm = async () => {
    if (realmEntityId) {
      const resourceAddresses = await getSeasonAddresses();
      console.log({ resourceAddresses });
      const tokenAddress =
        resourceAddresses[selectedResourceContract.toLocaleUpperCase() as keyof typeof resourceAddresses][1];
      try {
        setIsLoading(true);
        await bridgeIntoRealm(
          tokenAddress as string,
          ADMIN_BANK_ENTITY_ID,
          BigInt(realmEntityId!),
          BigInt((selectedResourceAmount as unknown as number) * 10 ** 18),
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      console.error("\n\n\n\n Realm does not exist in game yet. settle the realm!\n\n\n\n");
    }
  };

  return (
    <div className="w-96 flex flex-col gap-3">
      <div className="flex justify-between">
        <div>From Wallet</div>

        <div>{displayAddress(account?.address || "")}</div>
      </div>
      <Select onValueChange={(value) => setRealmEntityId(value)}>
        <SelectTrigger className="w-full border-gold/15">
          <SelectValue placeholder="Select Realm To Transfer" />
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

      <SelectResourceToBridge
        selectedResourceAmount={selectedResourceAmount}
        setselectedResourceAmount={setselectedResourceAmount}
        setselectedResourceContract={setselectedResourceContract}
      />
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <div>Time to Transfer</div>
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
            <div className="flex items-center"><Plus className="mr-4" />Total Transfer Fee</div>
            <div>{totalFeeOnDeposit}</div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <div>Bank Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.max_bank_fee_dpt_percent)}%)</div>
              <div>{bankFeeOnDeposit}</div>
            </div>
            <div className="flex justify-between text-xs">
              <div>Velords Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.velords_fee_on_dpt_percent)}%)</div>
              <div>{velordsFeeOnDeposit}</div>
            </div>
            <div className="flex justify-between text-xs">
              <div>
                Season Pool Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.season_pool_fee_on_dpt_percent)}%)
              </div>
              <div>{seasonPoolFeeOnDeposit}</div>
            </div>
            <div className="flex justify-between text-xs">
              <div>Client Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.client_fee_on_dpt_percent)}%)</div>
              <div>{clientFeeOnDeposit}</div>
            </div>
            <div className="flex justify-between font-bold mt-5 mb-5">
              <div>Total Amount Received</div>
              <div>{formatFee(Number(selectedResourceAmount) - Number(totalFeeOnDeposit))}</div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Button
        disabled={(!selectedResourceAmount && !selectedResourceContract && !realmEntityId) || isLoading}
        onClick={() => onBridgeIntoRealm()}
      >
        {isLoading && <Loader className="animate-spin pr-2" />}
        {isLoading ? "Transferring..." : "Initiate Transfer"}
      </Button>
    </div>
  );
};

export const SelectResourceToBridge = ({
  selectedResourceAmount,
  setselectedResourceAmount,
  setselectedResourceContract,
}: {
  selectedResourceAmount: string;
  setselectedResourceAmount: (value: string) => void;
  setselectedResourceContract: (value: string) => void;
}) => {
  return (
    <div className="rounded-lg p-3 border border-gold/15 shadow-lg bg-dark-brown flex gap-3">
      <Input
        type="text"
        placeholder="0.0"
        value={selectedResourceAmount}
        onChange={(e) => setselectedResourceAmount(e.target.value)}
        className="bg-dark-brown text-2xl w-full outline-none h-16 border-none "
      />

      <Select onValueChange={(value) => setselectedResourceContract(value)}>
        <SelectTrigger className="w-[180px] border-gold/15">
          <SelectValue placeholder="Select Resource" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(ResourcesIds)
            .filter((resource) => isNaN(Number(resource)))
            .map((resource) => (
              <SelectItem key={resource} value={resource.toString()}>
                {resource}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
};
