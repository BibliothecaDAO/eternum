import type { Call } from "starknet";
import { useMemo } from "react";
import L2BridgeABI from "@/abi/L2/LordsBridge.json";
import { SUPPORTED_L2_CHAIN_ID } from "@/constants/env";
import {
  useContract,
  useSendTransaction as useL2ContractWrite,
} from "@starknet-react/core";
import { parseEther } from "viem";
import { useAccount as useL1Account } from "wagmi";

import { LORDS_BRIDGE_ADDRESS } from "@realms-world/constants";

export const useWriteInitiateWithdrawLords = ({
  amount,
}: {
  amount: string | null;
}) => {
  const { address: addressL1 } = useL1Account();

  const l2BridgeAddress = LORDS_BRIDGE_ADDRESS[SUPPORTED_L2_CHAIN_ID];
  const { contract } = useContract({
    abi: L2BridgeABI,
    address: l2BridgeAddress as `0x${string}`,
  });

  const calls: Call[] = useMemo(() => {
    if (!amount || !addressL1 || !contract) return [];
    return [
      contract?.populate("initiate_withdrawal", [
        addressL1,
        {
          low: parseEther(amount),
          high: 0,
        },
      ]),
    ];
  }, [addressL1, amount, contract]);

  const { sendAsync, data: withdrawHash } = useL2ContractWrite({ calls });

  return {
    calls,
    sendAsync,
    withdrawHash,
  };
};
