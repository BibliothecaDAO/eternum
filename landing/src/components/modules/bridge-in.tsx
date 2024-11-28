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
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { env } from "../../../env";
import resourceAddressesLocal from "../../data/resource_addresses/local/resource_addresses.json";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { calculateDonkeysNeeded, getTotalResourceWeight } from "../ui/utils/utils";

function formatFee(fee: number) {
  return fee.toFixed(2);
}

export const BridgeIn = () => {
  const {
    account: { account },
  } = useDojo();
  const { getRealmEntityIdFromRealmId } = useRealm();
  const { computeTravelTime } = useTravel();

  const [selectedResourceContract, setselectedResourceContract] = useState("");
  const [selectedResourceAmount, setselectedResourceAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [realmId, setRealmId] = useState<string>("");

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

  const { data: seasonPassMints } = useSuspenseQuery({
    queryKey: ["ERCMints"],
    queryFn: () => execute(GET_ERC_MINTS),
    refetchInterval: 10_000,
  });

  const seasonPassTokens = useMemo(
    () =>
      seasonPassMints?.tokenTransfers?.edges
        ?.filter(
          (token) =>
            token?.node?.tokenMetadata.__typename == "ERC721__Token" &&
            token.node.tokenMetadata.contractAddress === env.VITE_SEASON_PASS_ADDRESS,
        )
        .map((token) => {
          if (token?.node?.tokenMetadata.__typename !== "ERC721__Token") return undefined;
          return {
            id: Number(token.node.tokenMetadata.tokenId),
            name_: JSON.parse(token.node.tokenMetadata.metadata).name,
          };
        })
        .filter((token): token is { id: number; name_: string } => token !== undefined),
    [seasonPassMints],
  );

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
  }, [selectedResourceContract, realmId, selectedResourceAmount]);

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
      const resourceAddresses = resourceAddressesLocal;
      let tokenAddress =
        resourceAddresses[selectedResourceContract.toLocaleUpperCase() as keyof typeof resourceAddressesLocal][1];
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

        <div>{displayAddress(account?.address)}</div>
      </div>
      <Select onValueChange={(value) => setRealmId(value)}>
        <SelectTrigger className="w-full border-gold/15">
          <SelectValue placeholder="Select Realm To Transfer" />
        </SelectTrigger>
        <SelectContent>
          {seasonPassTokens?.map((token) => (
            <SelectItem key={token.id} value={token.id.toString()}>
              {token.name_} {token.id} {!getRealmEntityIdFromRealmId(token.id) && <span>(NOT IN GAME)</span>}
            </SelectItem>
          ))}
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
        <div className="flex justify-between font-bold">
          <div>Total Transfer Fee</div>
          <div>{totalFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>Bank Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.max_bank_fee_dpt_percent)}%)</div>
          <div>{bankFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>Velords Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.velords_fee_on_dpt_percent)}%)</div>
          <div>{velordsFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>Season Pool Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.season_pool_fee_on_dpt_percent)}%)</div>
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
      </div>
      <Button
        disabled={(!selectedResourceAmount && !selectedResourceContract && !realmId) || isLoading}
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
