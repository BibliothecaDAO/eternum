import { VeLords } from "@/abi/L2/VeLords";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { StakingAddresses } from "@realms-world/constants";
import {
  Address,
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";

export const ClaimRewards = () => {
  const veLordsAddress = StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID];
  const { address } = useAccount();
  const { contract: veLordsContract } = useContract({
    abi: VeLords,
    address: veLordsAddress as Address,
  });
  const {
    sendAsync: claimRewards,
    data: claimHash,
    isPending: claimIsSubmitting,
  } = useSendTransaction({
    calls:
      veLordsContract && address
        ? [veLordsContract?.populate("withdraw", [])]
        : undefined,
  });

  return <div>ClaimRewards</div>;
};
