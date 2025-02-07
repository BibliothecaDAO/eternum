import type { Call } from "starknet";
import { useMemo } from "react";
import { RealmsBridge } from "@/abi/L2/RealmsBridge";
import { useContract, useSendTransaction } from "@starknet-react/core";
import { useAccount as useL1Account } from "wagmi";

import { REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";

export const useWriteInitiateWithdrawRealms = ({
  selectedTokenIds,
}: {
  selectedTokenIds: string[];
}) => {
  const { address: addressL1 } = useL1Account();

  const { contract } = useContract({
    abi: RealmsBridge,
    address: REALMS_BRIDGE_ADDRESS[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
  });

  const calls: Call[] = useMemo(() => {
    if (!selectedTokenIds.length || !addressL1 || !contract) return [];

    return [
      contract?.populate("deposit_tokens", [
        Date.now(),
        addressL1,
        selectedTokenIds.map((tokenId) => BigInt(tokenId)),
      ]),
    ];
  }, [selectedTokenIds, addressL1, contract]);

  const sendTx = useSendTransaction({ calls });

  return {
    calls,
    ...sendTx,
  };
};
