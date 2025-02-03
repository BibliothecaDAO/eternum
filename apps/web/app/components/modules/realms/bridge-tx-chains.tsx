
import EthereumIcon from "@/components/icons/ethereum.svg";
import StarknetIcon from "@/components/icons/starknet.svg";
import { ChainId } from "@realms-world/constants";
import { ArrowRight } from "lucide-react";
export const TransactionChains: React.FC<{ fromChain: string | number }> = ({ fromChain }) => {
    const isFromEthereum = [ChainId.MAINNET, ChainId.SEPOLIA].includes(Number(fromChain) as ChainId);
  
    const sourceChain = isFromEthereum
      ? { icon: <EthereumIcon className="w-4 h-4" />, label: "Ethereum" }
      : { icon: <StarknetIcon className="w-4 h-4" />, label: "Starknet" };
  
    const destinationChain = isFromEthereum
      ? { icon: <StarknetIcon className="w-4 h-4" />, label: "Starknet" }
      : { icon: <EthereumIcon className="w-4 h-4" />, label: "Ethereum" };
  
    return (
      <>
        <span className="flex items-center gap-2">
          {sourceChain.icon} {sourceChain.label}
        </span>
        <ArrowRight />
        <span className="flex items-center gap-2">
          {destinationChain.icon} {destinationChain.label}
        </span>
      </>
    );
  };