import { lordsAddress } from "@/config";
import { useEffect, useState } from "react";
import { getManifest } from "../../dojoConfig";
import { env } from "./../../env";
import { useDojo } from "./context/DojoContext";

const ERC20EVENT_SELECTOR = "0x166373381772db0a01c3a66865fc326c297787697aa52a6ea318e38c42302f7";
const TRANSFER_SELECTOR = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
const START_BLOCK = 951460;

export const useLordsBridgedIn = () => {
  const {
    network: { provider },
  } = useDojo();

  const [lordsBridgedIn, setLordsBridgedIn] = useState<bigint>(0n);

  const manifest = getManifest();
  const bridgeContract = manifest.contracts.find((contract) => contract.tag === "s0_eternum-resource_bridge_systems");

  // lords contract is different between mainnet and sepolia/local
  const isMainnet = env.VITE_PUBLIC_CHAIN === "mainnet";

  const keys = isMainnet
    ? [[TRANSFER_SELECTOR]]
    : [
        // Event key
        [ERC20EVENT_SELECTOR],
        // Transfer selector
        [TRANSFER_SELECTOR],
        // from anybody
        [],
        // bridge contract address
        [bridgeContract?.address || "0x0"],
      ];

  const block_number = isMainnet ? START_BLOCK : 0;

  useEffect(() => {
    const fetchTransferEvents = async () => {
      try {
        const events = await provider.provider.getEvents({
          address: lordsAddress,
          from_block: { block_number },
          to_block: "latest",
          keys,
          chunk_size: 100,
        });

        let total = 0n;
        events.events.forEach((event) => {
          total += BigInt(event.data[0]);
        });

        setLordsBridgedIn(total);
      } catch (error) {
        console.error("Error fetching transfer events:", error);
      }
    };

    fetchTransferEvents();
  }, [provider, bridgeContract?.address]);

  return Number(lordsBridgedIn) / 10 ** 18;
};

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
