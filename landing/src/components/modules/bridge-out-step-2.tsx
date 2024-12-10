import { useEntities } from "@/hooks/helpers/useEntities";
import { donkeyArrivals } from "@/hooks/helpers/useResources";
import { useBridgeAsset } from "@/hooks/useBridge";
import { displayAddress } from "@/lib/utils";
import {
  ADMIN_BANK_ENTITY_ID,
  BRIDGE_FEE_DENOMINATOR,
  EternumGlobalConfig,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useAccount } from "@starknet-react/core";
import { Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { TypeP } from "../typography/type-p";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ShowSingleResource } from "../ui/SelectResources";
import { getSeasonAddresses } from "../ui/utils/utils";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeOutStep2 = () => {
  const { address } = useAccount();

  const { getOwnerArrivalsAtBank, getDonkeyInfo } = donkeyArrivals();
  const [donkeyEntityId, setDonkeyEntityId] = useState(0n);
  const [isLoading, setIsLoading] = useState(false);

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
  const realmEntityIds = useMemo(() => {
    return playerRealms.map((realm) => realm!.entity_id);
  }, [playerRealms]);

  const donkeysArrivals = useMemo(() => getOwnerArrivalsAtBank(realmEntityIds as number[]), [realmEntityIds]);
  const donkeyInfos = useMemo(() => {
    return donkeysArrivals.map((donkey) => getDonkeyInfo(donkey));
  }, [donkeysArrivals]);

  const { bridgeFinishWithdrawFromRealm } = useBridgeAsset();

  const onFinishWithdrawFromBank = async () => {
    if (selectedResourceId) {
      const resourceAddresses = await getSeasonAddresses();
      const selectedResourceName = ResourcesIds[selectedResourceId];
      const tokenAddress = resourceAddresses[selectedResourceName.toUpperCase() as keyof typeof resourceAddresses][1];
      try {
        setIsLoading(true);
        await bridgeFinishWithdrawFromRealm(tokenAddress as string, ADMIN_BANK_ENTITY_ID, donkeyEntityId);
      } finally {
        setDonkeyEntityId(0n);
        setSelectedResourceIds([]);
        setSelectedResourceAmounts({});
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-md flex flex-col gap-3">
      <TypeP>
        Finalise the withdrawal of resources from your Realm in Eternum to your Starknet wallet. The bridge will close
        and you will be unable to withdraw 1 hour after the Season is won
      </TypeP>
      <hr />
      <div className="flex justify-between">
        <div className="flex flex-col min-w-40">
          <div className="text-xs uppercase mb-1 ">Select Donkey</div>
          <Select
            onValueChange={(value) => {
              if (value === null) {
                setDonkeyEntityId(0n);
                setSelectedResourceIds([]);
                setSelectedResourceAmounts({});
                return;
              }
              const currentDonkeyInfo = donkeyInfos?.find((donkey) => donkey.donkeyEntityId?.toString() === value);
              setDonkeyEntityId(BigInt(value));
              setSelectedResourceIds([(currentDonkeyInfo!.donkeyResources[0].resourceId as never) ?? 0]);
              setSelectedResourceAmounts({
                [currentDonkeyInfo!.donkeyResources[0].resourceId ?? 0]:
                  currentDonkeyInfo!.donkeyResources[0].amount / RESOURCE_PRECISION,
              });
            }}
          >
            <SelectTrigger className="w-full border-gold/15">
              <SelectValue placeholder="Select Donkey At Bank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={"choose"} value={null}>
                Choose a donkey
              </SelectItem>
              {donkeyInfos?.map((donkey) => (
                <SelectItem key={donkey.donkeyEntityId} value={donkey.donkeyEntityId?.toString() ?? ""}>
                  Donkey Drove {donkey.donkeyEntityId}{" "}
                  {Number(donkey.donkeyArrivalTime) * 1000 <= Date.now()
                    ? "(Arrived!)"
                    : `(Arrives in ${Math.floor(
                        (Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60 * 60),
                      )}h ${Math.floor(((Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60)) % 60)}m)`}
                </SelectItem>
              ))}
              {!donkeyInfos?.length && <div>No donkeys found at the bank</div>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs uppercase mb-1">To</div>
          <div>{displayAddress(address || "")}</div>
        </div>
      </div>
      {selectedResourceIds.length > 0 && (
        <SelectResourceRow
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={(value: number[]) => setSelectedResourceIds(value as unknown as never[])}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
        />
      )}
      <div className="flex flex-col gap-1">
        <hr />
        <div className="flex justify-between font-bold">
          <div>Total Transfer Fee</div>
          <div>{totalFeeOnWithdrawal}</div>
        </div>
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
        <div className="flex justify-between font-bold mt-5 mb-5">
          <div>Total Amount Received</div>
          <div>{formatFee(Number(selectedResourceAmount) - Number(totalFeeOnWithdrawal))}</div>
        </div>
      </div>
      <Button
        disabled={(!selectedResourceAmount && !donkeyEntityId && !selectedResourceId) || isLoading}
        onClick={() => onFinishWithdrawFromBank()}
      >
        {isLoading && <Loader className="animate-spin pr-2" />}
        {isLoading ? "Sending to Wallet..." : "Send to Wallet (Final Step)"}
      </Button>
    </div>
  );
};

export const SelectResourceRow = ({
  selectedResourceIds,
  setSelectedResourceIds,
  selectedResourceAmounts,
  setSelectedResourceAmounts,
}: {
  selectedResourceIds: number[];
  setSelectedResourceIds: (value: number[]) => void;
  selectedResourceAmounts: { [key: string]: number };
  setSelectedResourceAmounts: (value: { [key: string]: number }) => void;
}) => {
  return (
    <div className="grid grid-cols-0 gap-8 px-8 h-full">
      <div className=" bg-gold/10  h-auto border border-gold/40">
        <ShowSingleResource
          selectedResourceIds={selectedResourceIds}
          setSelectedResourceIds={setSelectedResourceIds}
          selectedResourceAmounts={selectedResourceAmounts}
          setSelectedResourceAmounts={setSelectedResourceAmounts}
          entity_id={0}
        />
      </div>
    </div>
  );
};
