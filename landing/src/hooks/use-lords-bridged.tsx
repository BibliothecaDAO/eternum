import { lordsAddress } from "@/config";
import { useEffect, useState } from "react";
import { getManifest } from "../../dojoConfig";
import { useDojo } from "./context/DojoContext";

const EVENT_KEY = "0x166373381772db0a01c3a66865fc326c297787697aa52a6ea318e38c42302f7";
const TRANSFER_SELECTOR = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";

export const useLordsBridgeBalance = () => {
  const {
    network: { provider },
  } = useDojo();

  const [lordsBalance, setLordsBalance] = useState<bigint>(0n);
  const [lordsBridgedIn, setLordsBridgedIn] = useState<bigint>(0n);

  const manifest = getManifest();
  const bridgeContract = manifest.contracts.find((contract) => contract.tag === "s0_eternum-resource_bridge_systems");

  //   useEffect(() => {
  //     const fetchTransferEvents = async () => {
  //       try {
  //         const events = await provider.provider.getEvents({
  //           address: lordsAddress,
  //           from_block: { block_number: 0 },
  //           to_block: "latest",
  //           keys: [
  //             [EVENT_KEY],
  //             // Transfer selector
  //             [TRANSFER_SELECTOR],
  //             // from address 0
  //             [],
  //             //
  //             // bridge contract address
  //             ["0x5f8688246c1b9e9b0276712ceae7a73a5e938799fb79205d5918b2cdf6883c5"],
  //           ], // Filter for Transfer events
  //           chunk_size: 100,
  //         });

  //         console.log({ events });

  //         let total = 0n;
  //         events.events.forEach((event) => {
  //           total += BigInt(event.data[0]);
  //         });

  //         setLordsBridgedIn(total);
  //       } catch (error) {
  //         console.error("Error fetching transfer events:", error);
  //       }
  //     };

  //     fetchTransferEvents();
  //   }, [provider, bridgeContract?.address]);

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

  return [Number(lordsBridgedIn) / 10 ** 8, Number(lordsBalance) / 10 ** 18];
};
