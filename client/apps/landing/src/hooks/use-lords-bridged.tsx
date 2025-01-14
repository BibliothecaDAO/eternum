import { lordsAddress } from "@/config";
import { useEffect, useState } from "react";
import { getManifest } from "../../dojoConfig";
import { useDojo } from "./context/DojoContext";

export const useLordsBridgeBalance = () => {
  const {
    network: { provider },
  } = useDojo();

  const [lordsBalance, setLordsBalance] = useState<bigint>(0n);

  const manifest = getManifest();
  const bridgeContract = manifest.contracts.find((contract) => contract.tag === "s0_eternum-resource_bridge_systems");

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
