import { useMemo, useState } from "react";

import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { Button } from "@/ui/design-system/atoms";
import { getContractByName } from "@dojoengine/core";
import { HStack, VStack } from "@pm/ui";
import { useAccount } from "@starknet-react/core";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";

export const MarketResolution = ({ market }: { market: MarketClass }) => {
  const {
    config: { manifest },
  } = useDojoSdk();
  const { account } = useAccount();
  const [isResolving, setIsResolving] = useState(false);

  // Use uint256 for market id as calldata
  const marketId_u256 = useMemo(() => uint256.bnToUint256(BigInt(market.market_id)), [market.market_id]);

  const onResolve = async () => {
    if (!account) {
      toast.error("Connect a wallet to resolve the market.");
      return;
    }
    const marketAddress = getContractByName(manifest, "pm", "Markets")!.address;

    const resolveCall: Call = {
      contractAddress: marketAddress,
      entrypoint: "resolve",
      calldata: [marketId_u256.low, marketId_u256.high],
    };

    setIsResolving(true);
    try {
      await account.execute([resolveCall]);
      toast.success("Market resolved");
    } catch (error) {
      console.error("Failed to resolve market", error);
      toast.error("Failed to resolve market");
    } finally {
      setIsResolving(false);
    }
  };

  const canResolve = market.isResolvable() && !market.isResolved();

  return (
    <VStack className="items-start gap-3">
      <div className="text-sm text-gold/70">Trigger resolution once the oracle data is ready.</div>
      <HStack className="gap-3">
        <Button onClick={onResolve} disabled={!canResolve || isResolving} isLoading={isResolving}>
          {isResolving ? "Resolving..." : "Resolve Market"}
        </Button>
        {!canResolve && <span className="text-xs text-gold/60">Resolution opens after the resolve time.</span>}
      </HStack>
    </VStack>
  );
};
