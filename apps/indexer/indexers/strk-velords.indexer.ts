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

import { ChainId, StakingAddresses } from "@realms-world/constants";
import { db } from "@realms-world/db/poolClient";
import {
  velords_lords_locked,
  velords_rewards_received,
} from "@realms-world/db/schema";

import { env } from "../env";
import { toDecimalAmount } from "./amount-utils";

export default function (/*runtimeConfig: ApibaraRuntimeConfig*/) {
  return createIndexer({ database: db });
}
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

    finality: "pending",
    startingCursor: {
      orderKey: env.VITE_PUBLIC_CHAIN === "sepolia" ? 76_103n : 699_904n,
    },
    filter: {
      events: [
        {
          address: StakingAddresses.rewardpool[l2ChainId] as `0x${string}`,
          keys: [getSelector("RewardReceived")],
        },
        {
          address: StakingAddresses.velords[l2ChainId] as `0x${string}`,
          keys: [getSelector("ModifyLock")],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        schema: { velords_lords_locked, velords_rewards_received },
        idColumn: "_id",
        persistState: true,
        indexerName: "starknet-realms-lords-claims",
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
        if (event.keys[0] === getSelector("RewardReceived")) {
          const { args, transactionHash } = decodeEvent({
            abi: REWARDS_POOL_ABI,
            eventName: "lordship::reward_pool::reward_pool::RewardReceived",
            event,
          });

          await db
            .insert(velords_rewards_received)
            .values({
              transaction_hash: transactionHash,
              sender: args.sender.toString(),
              amount: toDecimalAmount(args.amount),
              timestamp: block.header.timestamp,
            })
            .onConflictDoNothing();
        }
        if (event.keys[0] === getSelector("ModifyLock")) {
          const { args, transactionHash } = decodeEvent({
            abi: VELORDS_ABI,
            eventName: "lordship::velords::velords::ModifyLock",
            event,
          });

          await db
            .insert(velords_lords_locked)
            .values({
              transaction_hash: transactionHash,
              owner: args.owner.toString(),
              amount: toDecimalAmount(args.amount),
              timestamp: block.header.timestamp,
              end_time: args.end_time,
            })
            .onConflictDoNothing();
        }
      }
    },
  });
}

export const REWARDS_POOL_ABI = [
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
    name: "IRewardPoolImpl",
    type: "impl",
    interface_name: "lordship::interfaces::IRewardPool::IRewardPool",
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
    name: "lordship::interfaces::IRewardPool::IRewardPool",
    type: "interface",
    items: [
      {
        name: "get_reward_token",
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
        name: "get_start_time",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_time_cursor",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_time_cursor_of",
        type: "function",
        inputs: [
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_last_token_time",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_tokens_per_week",
        type: "function",
        inputs: [
          {
            name: "week",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_token_last_balance",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_ve_supply",
        type: "function",
        inputs: [
          {
            name: "week",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "burn",
        type: "function",
        inputs: [
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "checkpoint_token",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "checkpoint_total_supply",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "claim",
        type: "function",
        inputs: [
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "OwnableTwoStepImpl",
    type: "impl",
    interface_name: "openzeppelin::access::ownable::interface::IOwnableTwoStep",
  },
  {
    name: "openzeppelin::access::ownable::interface::IOwnableTwoStep",
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
    ],
  },
  {
    name: "constructor",
    type: "constructor",
    inputs: [
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "velords",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "reward_token",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "start_time",
        type: "core::integer::u64",
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
    name: "lordship::reward_pool::reward_pool::CheckpointToken",
    type: "event",
    members: [
      {
        kind: "data",
        name: "time",
        type: "core::integer::u64",
      },
      {
        kind: "data",
        name: "tokens",
        type: "core::integer::u256",
      },
    ],
  },
  {
    kind: "struct",
    name: "lordship::reward_pool::reward_pool::Claimed",
    type: "event",
    members: [
      {
        kind: "key",
        name: "recipient",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "amount",
        type: "core::integer::u256",
      },
      {
        kind: "data",
        name: "claim_epoch",
        type: "core::integer::u64",
      },
      {
        kind: "data",
        name: "max_epoch",
        type: "core::integer::u64",
      },
    ],
  },
  {
    kind: "struct",
    name: "lordship::reward_pool::reward_pool::RewardReceived",
    type: "event",
    members: [
      {
        kind: "key",
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "amount",
        type: "core::integer::u256",
      },
    ],
  },
  {
    kind: "enum",
    name: "lordship::reward_pool::reward_pool::Event",
    type: "event",
    variants: [
      {
        kind: "flat",
        name: "OwnableEvent",
        type: "openzeppelin::access::ownable::ownable::OwnableComponent::Event",
      },
      {
        kind: "flat",
        name: "UpgradeableEvent",
        type: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Event",
      },
      {
        kind: "nested",
        name: "CheckpointToken",
        type: "lordship::reward_pool::reward_pool::CheckpointToken",
      },
      {
        kind: "nested",
        name: "Claimed",
        type: "lordship::reward_pool::reward_pool::Claimed",
      },
      {
        kind: "nested",
        name: "RewardReceived",
        type: "lordship::reward_pool::reward_pool::RewardReceived",
      },
    ],
  },
] as const satisfies Abi;

export const VELORDS_ABI = [
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
    name: "IERC20Impl",
    type: "impl",
    interface_name: "lordship::interfaces::IERC20::IERC20",
  },
  {
    name: "core::byte_array::ByteArray",
    type: "struct",
    members: [
      {
        name: "data",
        type: "core::array::Array::<core::bytes_31::bytes31>",
      },
      {
        name: "pending_word",
        type: "core::felt252",
      },
      {
        name: "pending_word_len",
        type: "core::integer::u32",
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
    name: "core::bool",
    type: "enum",
    variants: [
      {
        name: "False",
        type: "()",
      },
      {
        name: "True",
        type: "()",
      },
    ],
  },
  {
    name: "lordship::interfaces::IERC20::IERC20",
    type: "interface",
    items: [
      {
        name: "name",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "symbol",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "decimals",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u8",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "total_supply",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "balance_of",
        type: "function",
        inputs: [
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "allowance",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "spender",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "transfer",
        type: "function",
        inputs: [
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "external",
      },
      {
        name: "transfer_from",
        type: "function",
        inputs: [
          {
            name: "sender",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "external",
      },
      {
        name: "approve",
        type: "function",
        inputs: [
          {
            name: "spender",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "external",
      },
      {
        name: "totalSupply",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "balanceOf",
        type: "function",
        inputs: [
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "transferFrom",
        type: "function",
        inputs: [
          {
            name: "sender",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "IVEImpl",
    type: "impl",
    interface_name: "lordship::interfaces::IVE::IVE",
  },
  {
    name: "lordship::velords::Lock",
    type: "struct",
    members: [
      {
        name: "amount",
        type: "core::integer::u128",
      },
      {
        name: "end_time",
        type: "core::integer::u64",
      },
    ],
  },
  {
    name: "lordship::velords::Point",
    type: "struct",
    members: [
      {
        name: "bias",
        type: "core::integer::i128",
      },
      {
        name: "slope",
        type: "core::integer::i128",
      },
      {
        name: "ts",
        type: "core::integer::u64",
      },
      {
        name: "block",
        type: "core::integer::u64",
      },
    ],
  },
  {
    name: "lordship::interfaces::IVE::IVE",
    type: "interface",
    items: [
      {
        name: "get_epoch_for",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_lock_for",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "lordship::velords::Lock",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_last_point",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "lordship::velords::Point",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_point_for_at",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "epoch",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "lordship::velords::Point",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_prior_votes",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "height",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_slope_change",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "ts",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::i128",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_reward_pool",
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
        name: "find_epoch_by_timestamp",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "ts",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "balance_of_at",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "ts",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "total_supply_at",
        type: "function",
        inputs: [
          {
            name: "height",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "manage_lock",
        type: "function",
        inputs: [
          {
            name: "amount",
            type: "core::integer::u256",
          },
          {
            name: "unlock_time",
            type: "core::integer::u64",
          },
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "checkpoint",
        type: "function",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "withdraw",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "(core::integer::u128, core::integer::u128)",
          },
        ],
        state_mutability: "external",
      },
      {
        name: "set_reward_pool",
        type: "function",
        inputs: [
          {
            name: "reward_pool",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "OwnableTwoStepImpl",
    type: "impl",
    interface_name: "openzeppelin::access::ownable::interface::IOwnableTwoStep",
  },
  {
    name: "openzeppelin::access::ownable::interface::IOwnableTwoStep",
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
    ],
  },
  {
    name: "lordship::interfaces::IERC20::IERC20Dispatcher",
    type: "struct",
    members: [
      {
        name: "contract_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    name: "constructor",
    type: "constructor",
    inputs: [
      {
        name: "lords_token",
        type: "lordship::interfaces::IERC20::IERC20Dispatcher",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
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
    name: "lordship::velords::velords::ModifyLock",
    type: "event",
    members: [
      {
        kind: "key",
        name: "caller",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "amount",
        type: "core::integer::u128",
      },
      {
        kind: "data",
        name: "end_time",
        type: "core::integer::u64",
      },
    ],
  },
  {
    kind: "struct",
    name: "lordship::velords::velords::Withdraw",
    type: "event",
    members: [
      {
        kind: "key",
        name: "caller",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "amount",
        type: "core::integer::u128",
      },
    ],
  },
  {
    kind: "struct",
    name: "lordship::velords::velords::Penalty",
    type: "event",
    members: [
      {
        kind: "key",
        name: "caller",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "amount",
        type: "core::integer::u128",
      },
    ],
  },
  {
    kind: "struct",
    name: "lordship::velords::velords::Supply",
    type: "event",
    members: [
      {
        kind: "data",
        name: "old_amount",
        type: "core::integer::u128",
      },
      {
        kind: "data",
        name: "new_amount",
        type: "core::integer::u128",
      },
    ],
  },
  {
    kind: "enum",
    name: "lordship::velords::velords::Event",
    type: "event",
    variants: [
      {
        kind: "flat",
        name: "OwnableEvent",
        type: "openzeppelin::access::ownable::ownable::OwnableComponent::Event",
      },
      {
        kind: "flat",
        name: "UpgradeableEvent",
        type: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Event",
      },
      {
        kind: "nested",
        name: "ModifyLock",
        type: "lordship::velords::velords::ModifyLock",
      },
      {
        kind: "nested",
        name: "Withdraw",
        type: "lordship::velords::velords::Withdraw",
      },
      {
        kind: "nested",
        name: "Penalty",
        type: "lordship::velords::velords::Penalty",
      },
      {
        kind: "nested",
        name: "Supply",
        type: "lordship::velords::velords::Supply",
      },
    ],
  },
] as const satisfies Abi;
