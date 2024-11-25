import { displayAddress, getEntityIdFromKeys } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { useDojo } from "@/hooks/context/DojoContext";
import { execute } from "@/hooks/gql/execute";
import { useRealm } from "@/hooks/helpers/useRealms";
import { GET_ERC_MINTS } from "@/hooks/query/realms";
import { useBridgeAsset } from "@/hooks/useBridge";
import { ADMIN_BANK_ENTITY_ID, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { env } from "../../../env";

export const Swap = () => {
  const [fromToken, setFromToken] = useState("");

  const [fromAmount, setFromAmount] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [realm, setRealms] = useState<string>("");
  const {account: { account }, setup } = useDojo();
  const {getRealmEntityIdFromRealmId} = useRealm();

  // const { data } = useSuspenseQuery({
  //   queryKey: ["erc721Balance", account?.address],
  //   queryFn: () => (account?.address ? execute(GET_REALMS, { accountAddress: account.address }) : null),
  //   refetchInterval: 10_000,
  // });

  const { data: seasonPassMints } = useSuspenseQuery({
    queryKey: ["ERCMints"],
    queryFn: () => execute(GET_ERC_MINTS),
    refetchInterval: 10_000,
  });

  const seasonPassTokens = useMemo(
    () =>
      seasonPassMints?.tokenTransfers?.edges?.filter((token) => token?.node?.tokenMetadata.__typename == 'ERC721__Token' && token.node.tokenMetadata.contractAddress === env.VITE_SEASON_PASS_ADDRESS)
        .map((token) => ({id: Number(token?.node?.tokenMetadata.tokenId), name_: JSON.parse(token?.node?.tokenMetadata.metadata).name}))
        .filter((id): id is {id: string, name_: string} => id !== undefined),
    [seasonPassMints],
  );


  const { bridgeIntoRealm } = useBridgeAsset();

  const onBridgeIntoRealm = async (realm: string, fromToken: string, fromAmount: string) => {
    const realmEntityId = getRealmEntityIdFromRealmId(Number(realm));

    try {
      setIsLoading(true);
        await bridgeIntoRealm(
          "0x5a4cee7e1bfee8a41f884cbdcb17f051ca7cd46bbd5598f91c01887b2f83ee6", 
          ADMIN_BANK_ENTITY_ID, 
          BigInt(realmEntityId),//todo : use realm entity id
          BigInt(fromAmount));
        // setFromAmount("");
        // setFromToken("");
        // setRealm("");
    } finally {
      setIsLoading(false);
    }

    const weightConfig = getComponentValue(
        setup.components.WeightConfig,
        getEntityIdFromKeys([BigInt(999999999), BigInt(254)]),
      );

    console.log(weightConfig);
    console.log({fromToken});
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
              {token.name_} ({token.id})
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
          <div>1hr</div>
        </div>
        <div className="flex justify-between">
          <div>Donkeys Needed</div>
          <div>50</div>
        </div>
        <hr />
        <div className="flex justify-between font-bold">
          <div>Total Transfer Fee</div>
          <div>100</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>veLORDS</div>
          <div>100</div>
        </div>
        <div className="flex justify-between text-xs">
          <div>client</div>
          <div>100</div>
        </div>
      </div>
      <Button disabled={(!fromAmount && !fromToken && !realm) || isLoading} onClick={() => onBridgeIntoRealm(realm, fromToken, fromAmount)}>
            {(isLoading) && <Loader className="animate-spin pr-2" />}
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
