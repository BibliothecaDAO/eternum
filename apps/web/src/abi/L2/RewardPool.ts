import type { Abi } from "starknet";

export const RewardPool = [
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
