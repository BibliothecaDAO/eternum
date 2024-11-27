import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { execute } from "@/hooks/gql/execute";
import { useRealm } from "@/hooks/helpers/useRealms";
import { GET_ERC_MINTS } from "@/hooks/query/realms";
import { useBridgeAsset } from "@/hooks/useBridge";
import { useTravel } from "@/hooks/useTravel";
import { displayAddress } from "@/lib/utils";
import { ADMIN_BANK_ENTITY_ID, DONKEY_ENTITY_TYPE, EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
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

export const Swap = () => {
  const {
    account: { account },
    setup,
  } = useDojo();
  const { getRealmEntityIdFromRealmId } = useRealm();
  const { computeTravelTime } = useTravel();

  const [fromToken, setFromToken] = useState("");

  const [fromAmount, setFromAmount] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [realm, setRealms] = useState<string>("");

  const feeDenominator = 10000;
  const velordsFeeOnDeposit = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.velords_fee_on_dpt_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
  );
  const seasonPoolFeeOnDeposit = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.season_pool_fee_on_dpt_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
  );
  const clientFeeOnDeposit = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.client_fee_on_dpt_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
  );
  const bankFeeOnDeposit = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.max_bank_fee_dpt_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
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

  const velordsFeeOnWithdrawal = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.velords_fee_on_wtdr_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
  );
  const seasonPoolFeeOnWithdrawal = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.season_pool_fee_on_wtdr_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
  );
  const clientFeeOnWithdrawal = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.client_fee_on_wtdr_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
  );
  const bankFeeOnWithdrawal = useMemo(
    () => formatFee((EternumGlobalConfig.bridge.max_bank_fee_wtdr_percent * Number(fromAmount)) / feeDenominator),
    [fromAmount],
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

  // const { data } = useSuspenseQuery({
  //   queryKey: ["erc721Balance", account?.address],
  //   queryFn: () => (account?.address ? execute(GET_REALMS, { accountAddress: account.address }) : null),
  //   refetchInterval: 10_000,
  // });
  const realmEntityId = useMemo(() => getRealmEntityIdFromRealmId(Number(realm)), [realm]);

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
        .map((token) => ({
          id: Number(token?.node?.tokenMetadata.tokenId),
          name_: JSON.parse(token?.node?.tokenMetadata.metadata).name,
        }))
        .filter((id): id is { id: string; name_: string } => id !== undefined),
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
  }, [fromToken, realm, fromAmount]);

  // travel time is always shown in minutes so write a function
  // to convert to hours and minutes and make it look beautiful

  const travelTimeInHoursAndMinutes = (travelTime: number) => {
    const hours = Math.floor(travelTime / 60);
    const minutes = travelTime % 60;
    return `${hours}h ${minutes}m`;
  };

  // const timeToTravel = Math.floor(
  //   ((distanceFromPosition / configManager.getSpeedConfig(DONKEY_ENTITY_TYPE)) * 3600) / 60 / 60,
  // );

  const orderWeight = useMemo(() => {
    if (fromToken && fromAmount) {
      const totalWeight = getTotalResourceWeight([
        { resourceId: ResourcesIds[fromToken as keyof typeof ResourcesIds], amount: Number(fromAmount) },
      ]);
      return totalWeight;
    } else {
      return 0;
    }
  }, [fromToken, fromAmount]);

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
      let tokenAddress = resourceAddresses[fromToken.toLocaleUpperCase()][1];
      try {
        setIsLoading(true);
        await bridgeIntoRealm(
          tokenAddress,
          ADMIN_BANK_ENTITY_ID,
          BigInt(realmEntityId!),
          BigInt(fromAmount * 10 ** 18),
        );
        // setFromAmount("");
        // setFromToken("");
        // setRealm("");
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
      <Select onValueChange={(value) => setRealms(value)}>
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

      <SwapRow
        fromAmount={fromAmount}
        setFromAmount={setFromAmount}
        fromToken={fromToken}
        setFromToken={setFromToken}
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
          <div>Bank Fees ({(EternumGlobalConfig.bridge.max_bank_fee_dpt_percent * 100) / feeDenominator}%)</div>
          <div>{bankFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>Velords Fees ({(EternumGlobalConfig.bridge.velords_fee_on_dpt_percent * 100) / feeDenominator}%)</div>
          <div>{velordsFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>
            Season Pool Fees ({(EternumGlobalConfig.bridge.season_pool_fee_on_dpt_percent * 100) / feeDenominator}%)
          </div>
          <div>{seasonPoolFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>Client Fees ({(EternumGlobalConfig.bridge.client_fee_on_dpt_percent * 100) / feeDenominator}%)</div>
          <div>{clientFeeOnDeposit}</div>
        </div>
        <div className="flex justify-between font-bold mt-5 mb-5">
          <div>Total Amount Received</div>
          <div>{formatFee(Number(fromAmount) - Number(totalFeeOnDeposit))}</div>
        </div>
      </div>
      <Button disabled={(!fromAmount && !fromToken && !realm) || isLoading} onClick={() => onBridgeIntoRealm()}>
        {isLoading && <Loader className="animate-spin pr-2" />}
        {isLoading ? "Transferring..." : "Initiate Transfer"}
      </Button>

      {/* <Button variant="cta">Initiate Transfer</Button> */}
    </div>
  );
};

export const SwapRow = ({
  fromAmount,
  setFromAmount,
  fromToken,
  setFromToken,
}: {
  fromAmount: string;
  setFromAmount: (value: string) => void;
  fromToken: string;
  setFromToken: (value: string) => void;
}) => {
  return (
    <div className="rounded-lg p-3 border border-gold/15 shadow-lg bg-dark-brown flex gap-3">
      <Input
        type="text"
        placeholder="0.0"
        value={fromAmount}
        onChange={(e) => setFromAmount(e.target.value)}
        className="bg-dark-brown text-2xl w-full outline-none h-16 border-none "
      />

      <Select onValueChange={(value) => setFromToken(value)}>
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
