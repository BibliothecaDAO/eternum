import { lordsAddress } from "@/config";
// why not working
// import { env } from "env";
import { useEffect, useState } from "react";
import { getGameManifest } from "../../../../common/utils";
import { useDojo } from "./context/DojoContext";

export const useLordsBridgeBalance = () => {
  const {
    network: { provider },
  } = useDojo();

  const [lordsBalance, setLordsBalance] = useState<bigint>(0n);

  const [bridgeContract, setBridgeContract] = useState<any>(null);

  useEffect(() => {
    const initManifest = async () => {
      const manifest = await getGameManifest(meta.env.VITE_PUBLIC_CHAIN);
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
