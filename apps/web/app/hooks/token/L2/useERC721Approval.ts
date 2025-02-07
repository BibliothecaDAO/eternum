import type { Call } from "starknet";
import { useMemo } from "react";
import { ERC721 } from "@/abi/L2/ERC721";
import {
  useContract,
  useSendTransaction as useL2ContractWrite,
} from "@starknet-react/core";
import { useAccount as useL1Account } from "wagmi";

export const useERC721Approval = ({
  contractAddress,
  operator,
  removeApproval,
}: {
  contractAddress: string;
  operator: string;
  removeApproval?: boolean;
}) => {
  const { address: addressL1 } = useL1Account();

  const { contract } = useContract({
    abi: ERC721,
    address: contractAddress as `0x${string}`,
  });

  const calls: Call[] = useMemo(() => {
    if (!contractAddress || !operator || !addressL1 || !contract) return [];
    return [
      contract.populate("set_approval_for_all", [
        operator,
        removeApproval ? false : true,
      ]),
    ];
  }, [contractAddress, operator, addressL1, contract, removeApproval]);

  const { sendAsync, ...writeReturn } = useL2ContractWrite({ calls });

  return {
    calls,
    sendAsync,
    ...writeReturn,
  };
};
