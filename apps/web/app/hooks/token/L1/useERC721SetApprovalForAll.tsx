import { useCallback } from "react";
import { ERC721_ABI } from "@/abi/L1/ERC721";
import { useWriteContract } from "wagmi";

const FUNCTION = "setApprovalForAll";

export function useERC721SetApprovalForAll({
  onSuccess,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (data: any) => void;
}) {
  const { writeContractAsync, error, ...writeReturn } = useWriteContract({
    mutation: { onSuccess: (data) => onSuccess?.(data) },
  });

  // if (!l2Address) throw new Error("Missing L2 Address");

  const writeAsync = useCallback(
    async ({
      contractAddress,
      operator,
    }: {
      contractAddress: `0x${string}`;
      operator: `0x${string}`;
    }) => {
      console.log(contractAddress, operator);

      return await writeContractAsync({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: FUNCTION,
        args: [operator, true],
      });
    },
    [writeContractAsync],
  );
  return { writeAsync, error, ...writeReturn };
}
