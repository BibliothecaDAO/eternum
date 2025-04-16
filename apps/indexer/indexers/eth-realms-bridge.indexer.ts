//import type { ApibaraRuntimeConfig } from "apibara/types";
import type { ApibaraRuntimeConfig } from "apibara/types";

import { EvmStream } from "@apibara/evm";
import { defineIndexer } from "@apibara/indexer";
import { useLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import { uint256 } from "starknet";
import { decodeEventLog, encodeEventTopics, numberToHex, parseAbi } from "viem";

import {
  ChainId,
  REALMS_BRIDGE_ADDRESS,
  STARKNET_MESSAGING,
} from "@realms-world/constants";
import { db } from "@realms-world/db/poolClient";
import {
  realmsBridgeEvents,
  realmsBridgeRequests,
} from "@realms-world/db/schema";

import { env } from "../env";

const abi = parseAbi([
  "event LogMessageToL2(address indexed fromAddress, uint256 indexed toAddress,uint256 indexed selector,uint256[] payload,uint256 nonce,uint256 fee)",
  "event ConsumedMessageToL2(address indexed fromAddress, uint256 indexed toAddress,uint256 indexed selector,uint256[] payload,uint256 nonce)",
  "event LogMessageToL1(uint256 indexed fromAddress,address indexed toAddress,uint256[] payload)",
  "event ConsumedMessageToL1(uint256 indexed fromAddress,address indexed toAddress,uint256[] payload)",
]);

const chainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
const l2ChainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;

export default function (runtimeConfig: ApibaraRuntimeConfig) {
  console.log("eth indexer started");
  console.log(env.VITE_PUBLIC_CHAIN);
  console.log("messaging ", STARKNET_MESSAGING[chainId]);
  console.log("from ", REALMS_BRIDGE_ADDRESS[chainId]);
  console.log("to " + BigInt(REALMS_BRIDGE_ADDRESS[l2ChainId]));

  return defineIndexer(EvmStream)({
    streamUrl:
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? "https://ethereum-sepolia.preview.apibara.org"
        : "https://ethereum.preview.apibara.org",
    finality: "accepted",
    startingBlock:
      env.VITE_PUBLIC_CHAIN === "sepolia" ? 6_180_467n : 204_33_152n,

    filter: {
      logs: [
        {
          address: STARKNET_MESSAGING[chainId] as `0x${string}`,
          topics: encodeEventTopics({
            abi,
            eventName: "LogMessageToL2",
            args: {
              fromAddress: REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`,
              toAddress: null,
            },
          }) as `0x${string}`[],
          strict: true,
        },
        {
          address: STARKNET_MESSAGING[chainId] as `0x${string}`,
          topics: encodeEventTopics({
            abi,
            eventName: "ConsumedMessageToL2",
            args: {
              fromAddress: REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`,
              toAddress: BigInt(REALMS_BRIDGE_ADDRESS[l2ChainId]),
            },
          }) as `0x${string}`[],
          strict: true,
        },
        {
          address: STARKNET_MESSAGING[chainId] as `0x${string}`,
          topics: encodeEventTopics({
            abi,
            eventName: "LogMessageToL1",
            args: {
              fromAddress: BigInt(REALMS_BRIDGE_ADDRESS[l2ChainId]),
              toAddress: REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`,
            },
          }) as `0x${string}`[],
          strict: true,
        },
        {
          address: STARKNET_MESSAGING[chainId] as `0x${string}`,
          topics: encodeEventTopics({
            abi,
            eventName: "ConsumedMessageToL1",
            args: {
              fromAddress: BigInt(REALMS_BRIDGE_ADDRESS[l2ChainId]),
              toAddress: REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`,
            },
          }) as `0x${string}`[],
          strict: true,
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: db,
        persistState: true,
        idColumn: "_id",
        indexerName: "eth-realms-bridge",
      }),
    ],
    async transform({ endCursor, block, finality }) {
      const logger = useLogger();
      const { db } = useDrizzleStorage();
      const { logs, header } = block;

      logger.info(
        "Transforming block | orderKey: ",
        endCursor?.orderKey,
        " | finality: ",
        finality,
      );

      for (const log of logs) {
        const decoded = decodeEventLog({
          abi,
          data: log.data,
          topics: [...log.topics] as [`0x${string}`, ...`0x${string}`[]],
        });

        const tokenCount = Number(decoded.args.payload[4]);
        const idArray = decoded.args.payload.slice(5);

        if (idArray.length < tokenCount * 2) {
          throw new Error("Insufficient data in payload for token IDs");
        }

        const tokenIds = Array.from({ length: tokenCount }, (_, i) => {
          const index = i * 2;
          return uint256.uint256ToBN({
            low: idArray[index],
            high: idArray[index + 1],
          });
        });

        const fromChain =
          decoded.eventName === "LogMessageToL1" ||
          decoded.eventName === "ConsumedMessageToL1"
            ? l2ChainId
            : chainId;

        await db
          .insert(realmsBridgeRequests)
          .values({
            from_chain: fromChain,
            from_address: numberToHex(decoded.args.payload[2]),
            to_address: numberToHex(decoded.args.payload[3]),
            token_ids: tokenIds,
            timestamp: header.timestamp,
            tx_hash: log.transactionHash,
            _id: decoded.args.payload,
            req_hash: uint256.uint256ToBN({
              low: decoded.args.payload[0],
              high: decoded.args.payload[1],
            }),
          })
          .onConflictDoNothing();

        const eventTypeMap = {
          LogMessageToL2: "deposit_initiated_l1",
          ConsumedMessageToL2: "withdraw_completed_l2",
          LogMessageToL1: "withdraw_available_l1",
          ConsumedMessageToL1: "withdraw_completed_l1",
        };

        const eventType = eventTypeMap[decoded.eventName];
        if (eventType) {
          await db
            .insert(realmsBridgeEvents)
            .values({
              timestamp: header.timestamp,
              hash: log.transactionHash,
              type: eventType,
              _id: decoded.args.payload,
            })
            .onConflictDoNothing();
        }
      }
    },
  });
}
