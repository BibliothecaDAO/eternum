import { StarknetStream, decodeEvent, getSelector } from "@apibara/starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ApibaraRuntimeConfig } from "apibara/types";
import type {
  ExtractTablesWithRelations,
  TablesRelationalConfig,
} from "drizzle-orm";
import { db } from "@realms-world/db/client";
import { hash, Abi, uint256 } from "starknet";
import { ChainId, REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";
import { env } from "../env";
import { formatUnits, numberToHex } from "viem";
import { realmsBridgeEvents, realmsBridgeRequests } from "@realms-world/db/schema";

export default function (runtimeConfig: ApibaraRuntimeConfig) {
  return createIndexer({ database: db });
}
const chainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;
const l2ChainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;

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

    finality: "accepted",
    startingCursor: {
      orderKey: 76_103n,
    },
    filter: {
      events: [
        {
          address: REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`,
          keys: [getSelector("WithdrawRequestCompleted") as `0x${string}`],
        },
        {
          address: REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`,
          keys: [getSelector("DepositRequestInitiated") as `0x${string}`],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        idColumn: "_id",
        persistState: false,
        indexerName: "starknet-realms-bridge",
      }),
    ],
    async transform({ endCursor, block, context, finality }) {
      const logger = useLogger();
      const { db } = useDrizzleStorage();
      const { events } = block;

      logger.info(
        "Transforming block | orderKey: ",
        endCursor?.orderKey,
        " | finality: ",
        finality
      );

      for (const event of events) {
        if (event.keys[0] === getSelector("WithdrawRequestCompleted")) {
          const { args, transactionHash } = decodeEvent({
            abi,
            eventName: "bridge::interfaces::WithdrawRequestCompleted",
            event,
          });
          const hash = uint256.bnToUint256(args.req_content.hash);
          const id = [
            BigInt(hash.low),
            BigInt(hash.high),
            args.req_content.owner_l1.address,
            BigInt(args.req_content.owner_l2),
            args.req_content.ids.length,
            ...args.req_content.ids.flatMap(id => {
              const token = uint256.bnToUint256(id);
              return [Number(token.low), Number(token.high)];
            }),
          ]
          await db
            .insert(realmsBridgeRequests)
            .values({
              from_chain: chainId,
              from_address: numberToHex(args.req_content.owner_l1.address),
              to_address: args.req_content.owner_l2,
              token_ids: args.req_content.ids,
              timestamp: block?.header?.timestamp,
              hash: transactionHash,
              id
            })
            .onConflictDoNothing();

          /*const eventTypeMap = {
            LogMessageToL2: "deposit_initiated_l1",
            ConsumedMessageToL2: "withdraw_completed_l2",
            LogMessageToL1: "withdraw_available_l1",
            ConsumedMessageToL1: "withdraw_completed_l1",
          };

          const eventType = eventTypeMap[decoded.eventName];*/
         // if (eventType) {
            await db.insert(realmsBridgeEvents).values({
              timestamp: block?.header?.timestamp,
              hash: transactionHash,
              type: "withdraw_completed_l2",
              id,
            }).onConflictDoNothing();
         // }
        } else if (event.keys[0] === getSelector("DepositRequestInitiated")) {
          const { args, transactionHash } = decodeEvent({
            abi,
            eventName: "bridge::interfaces::DepositRequestInitiated",
            event,
          });
          logger.info(args);
          const hash = uint256.bnToUint256(args.req_content.hash);
          const id = [
            BigInt(hash.low),
            BigInt(hash.high),
            args.req_content.owner_l1.address,
            BigInt(args.req_content.owner_l2),
            args.req_content.ids.length,
            ...args.req_content.ids.flatMap(id => {
              const token = uint256.bnToUint256(id);
              return [Number(token.low), Number(token.high)];
            }),
          ]
          await db
            .insert(realmsBridgeRequests)
            .values({
              from_chain: l2ChainId,
              from_address: numberToHex(args.req_content.owner_l1.address),
              to_address: args.req_content.owner_l2,
              token_ids: args.req_content.ids,
              timestamp: block?.header?.timestamp,
              hash: transactionHash,
              id
            })
            .onConflictDoNothing();
            await db.insert(realmsBridgeEvents).values({
              timestamp: block?.header?.timestamp,
              hash: transactionHash,
              type: "deposit_initiated_l2",
              id,
            }).onConflictDoNothing();
        }
      }
    },
  });
}
function prettyAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
