import { useDojo } from "@/hooks/context/DojoContext";
import { execute } from "@/hooks/gql/execute";
import { useRealm } from "@/hooks/helpers/useRealms";
import { donkeyArrivals } from "@/hooks/helpers/useResources";
import { GET_ERC_MINTS } from "@/hooks/query/realms";
import { useBridgeAsset } from "@/hooks/useBridge";
import { displayAddress } from "@/lib/utils";
import {
  ADMIN_BANK_ENTITY_ID,
  BRIDGE_FEE_DENOMINATOR,
  EternumGlobalConfig,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { env } from "../../../env";
import resourceAddressesLocal from "../../data/resource_addresses/local/resource_addresses.json";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ShowSingleResource } from "../ui/SelectResources";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeOutStep2 = () => {
  const {
    account: { account },
  } = useDojo();
  const { getRealmEntityIdFromRealmId } = useRealm();
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

  const { data: seasonPassMints } = useSuspenseQuery({
    queryKey: ["ERCMints"],
    queryFn: () => execute(GET_ERC_MINTS),
    refetchInterval: 10_000,
  });

  const seasonPassTokensInGame = useMemo(
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
        .filter((id): id is { id: number; name_: string } => id !== undefined)
        .filter((token) => Boolean(getRealmEntityIdFromRealmId(token.id))),
    [seasonPassMints],
  );

  const realmEntityIds = useMemo(
    () => seasonPassTokensInGame?.map((token) => getRealmEntityIdFromRealmId(token.id)),
    [seasonPassTokensInGame],
  );
  const donkeysArrivals = useMemo(() => getOwnerArrivalsAtBank(realmEntityIds as number[]), [realmEntityIds]);
  const donkeyInfos = useMemo(() => {
    return donkeysArrivals.map((donkey) => getDonkeyInfo(donkey));
  }, [donkeysArrivals]);

  const { bridgeFinishWithdrawFromRealm } = useBridgeAsset();

  const onFinishWithdrawFromBank = async () => {
    if (selectedResourceId) {
      const resourceAddresses = resourceAddressesLocal;
      const selectedResourceName = ResourcesIds[selectedResourceId];
      let tokenAddress =
        resourceAddresses[selectedResourceName.toUpperCase() as keyof typeof resourceAddressesLocal][1];
      try {
        setIsLoading(true);
        await bridgeFinishWithdrawFromRealm(tokenAddress as string, ADMIN_BANK_ENTITY_ID, donkeyEntityId);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-96 flex flex-col gap-3">
      <div className="flex justify-between">
        <div>From Wallet</div>

        <div>{displayAddress(account?.address)}</div>
      </div>
      <Select
        onValueChange={(value) => {
          setDonkeyEntityId(BigInt(value));
          setSelectedResourceIds([
            donkeyInfos?.find((donkey) => donkey.donkeyEntityId?.toString() === value)?.donkeyResources[0].resourceId ??
              0,
          ]);
          setSelectedResourceAmounts({
            [donkeyInfos?.find((donkey) => donkey.donkeyEntityId?.toString() === value)?.donkeyResources[0]
              .resourceId ?? 0]:
              donkeyInfos?.find((donkey) => donkey.donkeyEntityId?.toString() === value)?.donkeyResources[0].amount /
                RESOURCE_PRECISION ?? 0,
          });
        }}
      >
        <SelectTrigger className="w-full border-gold/15">
          <SelectValue placeholder="Select Donkey At Bank" />
        </SelectTrigger>
        <SelectContent>
          {donkeyInfos?.map((donkey) => (
            <SelectItem key={donkey.donkeyEntityId} value={donkey.donkeyEntityId?.toString() ?? ""}>
              Donkey {donkey.donkeyEntityId}{" "}
              {Number(donkey.donkeyArrivalTime) * 1000 <= Date.now()
                ? "(Arrived!)"
                : `(Arrives in ${Math.floor(
                    (Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60 * 60),
                  )}h ${Math.floor(((Number(donkey.donkeyArrivalTime) * 1000 - Date.now()) / (1000 * 60)) % 60)}m)`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
