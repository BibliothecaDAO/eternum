import type { Abi, Call } from "starknet";
import { useMemo } from "react";
import { RealmsBridge } from "@/abi/L2/RealmsBridge";
import { SUPPORTED_L2_CHAIN_ID } from "@/constants/env";
import {
  useContract,
  useNetwork,
  useSendTransaction,
} from "@starknet-react/core";
import { useAccount as useL1Account } from "wagmi";

import { REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";

export const useWriteInitiateWithdrawRealms = ({
  selectedTokenIds,
}: {
  selectedTokenIds: string[];
}) => {
  const { address: addressL1 } = useL1Account();

  const { contract } = useContract({
    abi: RealmsBridge,
    address: REALMS_BRIDGE_ADDRESS[SUPPORTED_L2_CHAIN_ID],
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const calls: Call[] = useMemo(() => {
    if (!selectedTokenIds.length || !addressL1) return [];

    return [
      contract?.populate("deposit_tokens", [
        Date.now(),
        addressL1,
        selectedTokenIds,
      ]),
    ];
  }, [selectedTokenIds, addressL1, contract]);
  const {
    sendAsync,
    data: withdrawHash,
    ...writeReturn
  } = useSendTransaction({ calls });

  return {
    calls,
    sendAsync,
    withdrawHash,
    ...writeReturn,
  };
};
