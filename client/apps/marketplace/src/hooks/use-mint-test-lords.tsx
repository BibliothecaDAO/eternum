import { lordsAddress } from "@/config";
import { useAccount, useSendTransaction } from "@starknet-react/core";

export const useMintTestLords = () => {
  const { address } = useAccount();

  const { send, error } = useSendTransaction({
    calls: [
      {
        contractAddress: lordsAddress,
        entrypoint: "mint_test_lords",
        calldata: [address || "0", "1000000000000000000000"], // 1000 Lords with 18 decimals
      },
    ],
  });

  const handleMintTestLords = async () => {
    if (!address) return;
    send();
  };

  return {
    mintTestLords: handleMintTestLords,
    error,
  };
};
