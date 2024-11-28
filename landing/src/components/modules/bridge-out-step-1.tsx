import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { execute } from "@/hooks/gql/execute";
import { useRealm } from "@/hooks/helpers/useRealms";
import { GET_ERC_MINTS } from "@/hooks/query/realms";
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
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { env } from "../../../env";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SelectSingleResource } from "../ui/SelectResources";
import { calculateDonkeysNeeded, getSeasonAddresses, getTotalResourceWeight } from "../ui/utils/utils";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeOutStep1 = () => {
  const {
    account: { account },
  } = useDojo();
  const { getRealmEntityIdFromRealmId } = useRealm();
  const { computeTravelTime } = useTravel();

  const [isLoading, setIsLoading] = useState(false);
  const [realmId, setRealmId] = useState<string>("");
  const { bridgeStartWithdrawFromRealm } = useBridgeAsset();
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [selectedResourceAmounts, setSelectedResourceAmounts] = useState<{ [key: string]: number }>({});
  const selectedResourceId = useMemo(() => selectedResourceIds[0] ?? 0, [selectedResourceIds]);
  const selectedResourceAmount = useMemo(
    () => selectedResourceAmounts[selectedResourceId] ?? 0,
    [selectedResourceAmounts, selectedResourceId],
  );

  const realmEntityId = useMemo(() => {
    if (!realmId) {
      return 0;
    }
    return getRealmEntityIdFromRealmId(Number(realmId));
  }, [realmId]);
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

  const { data: seasonPassMints } = useSuspenseQuery({
    queryKey: ["ERCMints"],
    queryFn: () => execute(GET_ERC_MINTS),
    refetchInterval: 10_000,
  });

  const seasonPassTokens = useMemo(
    () =>
      seasonPassMints?.tokenTransfers?.edges
        ?.filter((token) => {
          const metadata = token?.node?.tokenMetadata;
          return metadata?.__typename === "ERC721__Token" && metadata.contractAddress === env.VITE_SEASON_PASS_ADDRESS;
        })
        .map((token) => {
          const metadata = token?.node?.tokenMetadata;
          if (metadata?.__typename === "ERC721__Token") {
            return {
              id: Number(metadata.tokenId),
              name_: JSON.parse(metadata.metadata).name,
            };
          }
          return undefined;
        })
        .filter((id): id is { id: number; name_: string } => id !== undefined),
    [seasonPassMints],
  );

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
  }, [selectedResourceId, realmId, selectedResourceAmount]);

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

      let tokenAddress = resourceAddresses[selectedResourceName.toUpperCase() as keyof typeof resourceAddresses][1];
      try {
        setIsLoading(true);
        await bridgeStartWithdrawFromRealm(
          tokenAddress as string,
          ADMIN_BANK_ENTITY_ID,
          BigInt(realmEntityId!),
          BigInt(selectedResourceAmount * RESOURCE_PRECISION),
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

        <div>{displayAddress(account?.address)}</div>
      </div>
      <Select onValueChange={(value) => setRealmId(value)}>
        <SelectTrigger className="w-full border-gold/15">
          <SelectValue placeholder="Select Realm" />
        </SelectTrigger>
        <SelectContent>
          {seasonPassTokens?.map((token) => (
            <SelectItem key={token.id} value={token.id.toString()}>
              {token.name_} {token.id} {!getRealmEntityIdFromRealmId(token.id) && <span>(NOT IN GAME)</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        disabled={(!selectedResourceAmount && !selectedResourceId && !realmId) || isLoading}
        onClick={() => onSendToBank()}
      >
        {isLoading && <Loader className="animate-spin pr-2" />}
        {isLoading ? "Sending to Bank..." : "Send to Bank (Step 1)"}
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
    <div className="grid grid-cols-0 gap-8 px-8 h-full">
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
