import { lordsAddress } from "@/config";
import { Chain, getGameManifest } from "@contracts";
import { useEffect, useState } from "react";
import { env } from "../../env";
import { useDojo } from "./context/dojo-context";
const { VITE_PUBLIC_CHAIN } = env;

export const useLordsBridgeBalance = () => {
  const {
    network: { provider },
  } = useDojo();

  const [lordsBalance, setLordsBalance] = useState<bigint>(0n);

  const [bridgeContract, setBridgeContract] = useState<any>(null);

  useEffect(() => {
    const initManifest = async () => {
      const manifest: { contracts?: Array<{ tag: string; address?: string }> } = await getGameManifest(
        VITE_PUBLIC_CHAIN as Chain,
      );
      const bridge = manifest.contracts?.find(
        (contract: { tag: string }) => contract.tag === "s1_eternum-resource_bridge_systems",
      );
      setBridgeContract(bridge);
    };
    initManifest();
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const result = await provider.provider.callContract({
          contractAddress: lordsAddress,
          entrypoint: "balance_of",
          calldata: [bridgeContract?.address || "0x0"],
        });
        setLordsBalance(BigInt(result[0]));
      } catch (error) {
        console.error("Error fetching balance:", error);
        setLordsBalance(0n);
      }
    };

    fetchBalance();
  }, [provider, bridgeContract?.address]);

  return Number(lordsBalance) / 10 ** 18;
};
