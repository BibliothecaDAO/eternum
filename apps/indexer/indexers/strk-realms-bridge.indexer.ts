//import type { ApibaraRuntimeConfig } from "apibara/types";
import type {
  ExtractTablesWithRelations,
  TablesRelationalConfig,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Abi } from "starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import { decodeEvent, getSelector, StarknetStream } from "@apibara/starknet";
import { uint256 } from "starknet";
import { numberToHex } from "viem";

import { ChainId, REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";
import { db } from "@realms-world/db/poolClient";
import {
  realmsBridgeEvents,
  realmsBridgeRequests,
} from "@realms-world/db/schema";

import { env } from "../env";

export default function (/*runtimeConfig: ApibaraRuntimeConfig*/) {
  return createIndexer({ database: db });
}
const chainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
const l2ChainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;
const withdrawRequestCompletedSelector = getSelector("WithdrawRequestCompleted");
const depositRequestInitiatedSelector = getSelector("DepositRequestInitiated");

interface ParsedRequestContent {
  hash: bigint;
  ownerL1Address: bigint;
  ownerL2: bigint;
  ids: bigint[];
}

interface ParsedBridgeEvent {
  reqContent: ParsedRequestContent;
  transactionHash: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBigIntValue(value: unknown, fieldPath: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" || typeof value === "number") {
    return BigInt(value);
  }
  throw new Error(`Invalid bigint value for ${fieldPath}`);
}

function parseBridgeEvent(decoded: unknown): ParsedBridgeEvent {
  if (!isRecord(decoded)) {
    throw new Error("Invalid decoded event shape");
  }

  const transactionHash = decoded.transactionHash;
  if (typeof transactionHash !== "string") {
    throw new Error("Invalid transactionHash in decoded event");
  }

  const args = decoded.args;
  if (!isRecord(args)) {
    throw new Error("Missing args in decoded event");
  }

  const reqContent = args.req_content;
  if (!isRecord(reqContent)) {
    throw new Error("Missing req_content in decoded event args");
  }

  const ownerL1 = reqContent.owner_l1;
  if (!isRecord(ownerL1)) {
    throw new Error("Missing owner_l1 in decoded event args");
  }

  const idsValue = reqContent.ids;
  if (!Array.isArray(idsValue)) {
    throw new Error("Invalid ids in decoded event args");
  }

  const ids = idsValue.map((value, index) =>
    parseBigIntValue(value, `args.req_content.ids[${index}]`),
  );

  return {
    transactionHash,
    reqContent: {
      hash: parseBigIntValue(reqContent.hash, "args.req_content.hash"),
      ownerL1Address: parseBigIntValue(
        ownerL1.address,
        "args.req_content.owner_l1.address",
      ),
      ownerL2: parseBigIntValue(reqContent.owner_l2, "args.req_content.owner_l2"),
      ids,
    },
  };
}

function buildRequestId(reqContent: ParsedRequestContent): string {
  const hash = uint256.bnToUint256(reqContent.hash);
  const idParts = [
    BigInt(hash.low),
    BigInt(hash.high),
    reqContent.ownerL1Address,
    reqContent.ownerL2,
    reqContent.ids.length,
    ...reqContent.ids.flatMap((tokenId) => {
      const token = uint256.bnToUint256(tokenId);
      return [Number(token.low), Number(token.high)];
    }),
  ];

  return idParts.join(":");
}

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends
    TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  return defineIndexer(StarknetStream)({
    streamUrl:
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? "https://starknet-sepolia.preview.apibara.org"
        : "https://starknet.preview.apibara.org",

    finality: "pending",
    startingCursor: {
      orderKey: env.VITE_PUBLIC_CHAIN === "sepolia" ? 76_103n : 664_161n,
    },
    filter: {
      events: [
        {
          address: REALMS_BRIDGE_ADDRESS[l2ChainId] as `0x${string}`,
          keys: [withdrawRequestCompletedSelector],
        },
        {
          address: REALMS_BRIDGE_ADDRESS[l2ChainId] as `0x${string}`,
          keys: [depositRequestInitiatedSelector],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        schema: { realmsBridgeEvents, realmsBridgeRequests },
        idColumn: "_id",
        persistState: true,
        indexerName: "starknet-realms-bridge",
      }),
    ],
    async transform({ endCursor, block, finality }) {
      const logger = useLogger();
      const { db } = useDrizzleStorage();
      const { events } = block;

      logger.info(
        "Transforming block | orderKey: ",
        endCursor?.orderKey,
        " | finality: ",
        finality,
      );

      for (const event of events) {
        if (event.keys[0] === withdrawRequestCompletedSelector) {
          const decoded = parseBridgeEvent(
            decodeEvent({
              abi: abi as Abi,
              eventName: "bridge::interfaces::WithdrawRequestCompleted",
              event,
            }),
          );
          const requestId = buildRequestId(decoded.reqContent);
          await db
            .insert(realmsBridgeRequests)
            .values({
              from_chain: chainId,
              from_address: numberToHex(decoded.reqContent.ownerL1Address),
              to_address: numberToHex(decoded.reqContent.ownerL2),
              token_ids: decoded.reqContent.ids.map((id) => Number(id)),
              timestamp: block.header.timestamp,
              tx_hash: decoded.transactionHash,
              _id: requestId,
              req_hash: decoded.reqContent.hash.toString(),
            })
            .onConflictDoNothing();

          await db
            .insert(realmsBridgeEvents)
            .values({
              timestamp: block.header.timestamp,
              hash: decoded.transactionHash,
              type: "withdraw_completed_l2",
              _id: requestId,
            })
            .onConflictDoNothing();
        } else if (event.keys[0] === depositRequestInitiatedSelector) {
          const decoded = parseBridgeEvent(
            decodeEvent({
              abi: abi as Abi,
              eventName: "bridge::interfaces::DepositRequestInitiated",
              event,
            }),
          );
          const requestId = buildRequestId(decoded.reqContent);
          await db
            .insert(realmsBridgeRequests)
            .values({
              from_chain: l2ChainId,
              from_address: numberToHex(decoded.reqContent.ownerL2),
              to_address: numberToHex(decoded.reqContent.ownerL1Address),
              token_ids: decoded.reqContent.ids.map((id) => Number(id)),
              timestamp: block.header.timestamp,
              tx_hash: decoded.transactionHash,
              req_hash: decoded.reqContent.hash.toString(),
              _id: requestId,
            })
            .onConflictDoNothing();
          await db
            .insert(realmsBridgeEvents)
            .values({
              timestamp: block.header.timestamp,
              hash: decoded.transactionHash,
              type: "deposit_initiated_l2",
              _id: requestId,
            })
            .onConflictDoNothing();
        }
      }
    },
  });
}

const abi = [
  {
    name: "UpgradeableImpl",
    type: "impl",
    interface_name: "openzeppelin::upgrades::interface::IUpgradeable",
  },
  {
    name: "openzeppelin::upgrades::interface::IUpgradeable",
    type: "interface",
    items: [
      {
        name: "upgrade",
        type: "function",
        inputs: [
          {
            name: "new_class_hash",
            type: "core::starknet::class_hash::ClassHash",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "BridgeImpl",
    type: "impl",
    interface_name: "bridge::interfaces::IBridge",
  },
  {
    name: "core::starknet::eth_address::EthAddress",
    type: "struct",
    members: [
      {
        name: "address",
        type: "core::felt252",
      },
    ],
  },
  {
    name: "core::integer::u256",
    type: "struct",
    members: [
      {
        name: "low",
        type: "core::integer::u128",
      },
      {
        name: "high",
        type: "core::integer::u128",
      },
    ],
  },
  {
    name: "core::array::Span::<core::integer::u256>",
    type: "struct",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::integer::u256>",
      },
    ],
  },
  {
    name: "bridge::interfaces::IBridge",
    type: "interface",
    items: [
      {
        name: "deposit_tokens",
        type: "function",
        inputs: [
          {
            name: "salt",
            type: "core::felt252",
          },
          {
            name: "owner_l1",
            type: "core::starknet::eth_address::EthAddress",
          },
          {
            name: "token_ids",
            type: "core::array::Span::<core::integer::u256>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "set_l1_bridge_address",
        type: "function",
        inputs: [
          {
            name: "address",
            type: "core::starknet::eth_address::EthAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "set_l2_token_address",
        type: "function",
        inputs: [
          {
            name: "address",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "get_l1_bridge_address",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::eth_address::EthAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_l2_token_address",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    name: "OwnableTwoStepMixinImpl",
    type: "impl",
    interface_name:
      "openzeppelin::access::ownable::interface::OwnableTwoStepABI",
  },
  {
    name: "openzeppelin::access::ownable::interface::OwnableTwoStepABI",
    type: "interface",
    items: [
      {
        name: "owner",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "pending_owner",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "accept_ownership",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "transfer_ownership",
        type: "function",
        inputs: [
          {
            name: "new_owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "renounce_ownership",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "pendingOwner",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "acceptOwnership",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "transferOwnership",
        type: "function",
        inputs: [
          {
            name: "newOwner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "renounceOwnership",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "constructor",
    type: "constructor",
    inputs: [
      {
        name: "bridge_admin",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "l1_bridge_address",
        type: "core::starknet::eth_address::EthAddress",
      },
      {
        name: "l2_token_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    name: "bridge::request::Request",
    type: "struct",
    members: [
      {
        name: "hash",
        type: "core::integer::u256",
      },
      {
        name: "owner_l1",
        type: "core::starknet::eth_address::EthAddress",
      },
      {
        name: "owner_l2",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "ids",
        type: "core::array::Span::<core::integer::u256>",
      },
    ],
  },
  {
    name: "withdraw_auto_from_l1",
    type: "l1_handler",
    inputs: [
      {
        name: "from_address",
        type: "core::felt252",
      },
      {
        name: "req",
        type: "bridge::request::Request",
      },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    kind: "struct",
    name: "bridge::interfaces::DepositRequestInitiated",
    type: "event",
    members: [
      {
        kind: "key",
        name: "hash",
        type: "core::integer::u256",
      },
      {
        kind: "key",
        name: "block_timestamp",
        type: "core::integer::u64",
      },
      {
        kind: "data",
        name: "req_content",
        type: "bridge::request::Request",
      },
    ],
  },
  {
    kind: "struct",
    name: "bridge::interfaces::WithdrawRequestCompleted",
    type: "event",
    members: [
      {
        kind: "key",
        name: "hash",
        type: "core::integer::u256",
      },
      {
        kind: "key",
        name: "block_timestamp",
        type: "core::integer::u64",
      },
      {
        kind: "data",
        name: "req_content",
        type: "bridge::request::Request",
      },
    ],
  },
  {
    kind: "struct",
    name: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Upgraded",
    type: "event",
    members: [
      {
        kind: "data",
        name: "class_hash",
        type: "core::starknet::class_hash::ClassHash",
      },
    ],
  },
  {
    kind: "enum",
    name: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "Upgraded",
        type: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Upgraded",
      },
    ],
  },
  {
    kind: "struct",
    name: "openzeppelin::access::ownable::ownable::OwnableComponent::OwnershipTransferred",
    type: "event",
    members: [
      {
        kind: "key",
        name: "previous_owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "new_owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "openzeppelin::access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
    type: "event",
    members: [
      {
        kind: "key",
        name: "previous_owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "new_owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "enum",
    name: "openzeppelin::access::ownable::ownable::OwnableComponent::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "OwnershipTransferred",
        type: "openzeppelin::access::ownable::ownable::OwnableComponent::OwnershipTransferred",
      },
      {
        kind: "nested",
        name: "OwnershipTransferStarted",
        type: "openzeppelin::access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
      },
    ],
  },
  {
    kind: "enum",
    name: "bridge::bridge::bridge::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "DepositRequestInitiated",
        type: "bridge::interfaces::DepositRequestInitiated",
      },
      {
        kind: "nested",
        name: "WithdrawRequestCompleted",
        type: "bridge::interfaces::WithdrawRequestCompleted",
      },
      {
        kind: "flat",
        name: "UpgradeableEvent",
        type: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Event",
      },
      {
        kind: "flat",
        name: "OwnableEvent",
        type: "openzeppelin::access::ownable::ownable::OwnableComponent::Event",
      },
    ],
  },
] as const satisfies Abi;
