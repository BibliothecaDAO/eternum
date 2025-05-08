import { mainnet, sepolia } from "@starknet-react/chains";
import { useAccount, useDisconnect, useNetwork, useSwitchChain } from "@starknet-react/core";
import { useEffect, useState } from "react";
import { constants, shortString } from "starknet";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");

export const WrongNetworkDialog = () => {
  const { connector } = useAccount();
  const { account, chainId } = useAccount();
  const { chain } = useNetwork();
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
  const { disconnect } = useDisconnect();

  function bigintToStringHex(element: bigint | undefined): string {
    if (element === undefined) return "";

    const hex = element.toString(16);
    return element < 0 ? `-0x${hex.slice(1)}` : `0x${hex}`;
  }

  useEffect(() => {
    if (!account) {
      setIsWrongNetwork(false);
      return;
    }
    console.log(import.meta.env.VITE_PUBLIC_CHAIN);
    console.log(chain.id);
    console.log(account);
    setIsWrongNetwork(
      import.meta.env.VITE_PUBLIC_CHAIN === "sepolia"
        ? bigintToStringHex(chainId) === bigintToStringHex(mainnet.id)
        : bigintToStringHex(chainId) === bigintToStringHex(sepolia.id),
    );
  }, [account, chainId]);
  const { switchChainAsync } = useSwitchChain({
    params: {
      chainId:
        import.meta.env.VITE_PUBLIC_CHAIN === "local"
          ? KATANA_CHAIN_ID
          : import.meta.env.VITE_PUBLIC_CHAIN === "sepolia"
            ? (constants.StarknetChainId.SN_SEPOLIA as string)
            : (constants.StarknetChainId.SN_MAIN as string),
    },
  });
  return (
    <Dialog open={isWrongNetwork}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wrong Network</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          You are on the wrong network. Please switch to {import.meta.env.VITE_PUBLIC_CHAIN}
          <div className="mt-6 flex items-center gap-2">
            {connector?.id == "argentX" && (
              <Button onClick={() => switchChainAsync()}>Switch to {import.meta.env.VITE_PUBLIC_CHAIN}</Button>
            )}
            or
            <Button onClick={() => disconnect()}>Disconnect</Button>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
};
