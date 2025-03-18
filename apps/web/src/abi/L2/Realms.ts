import type { Abi } from "starknet";

export const RealmsABI = [
  {
    name: "get_votes",
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
    name: "get_past_votes",
    type: "function",
    inputs: [
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "timepoint",
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
    name: "get_past_total_supply",
    type: "function",
    inputs: [
      {
        name: "timepoint",
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
    name: "delegates",
    type: "function",
    inputs: [
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
    outputs: [
      {
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
    state_mutability: "view",
  },
  {
    name: "delegate",
    type: "function",
    inputs: [
      {
        name: "delegatee",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "delegate_by_sig",
    type: "function",
    inputs: [
      {
        name: "delegator",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "delegatee",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "nonce",
        type: "core::felt252",
      },
      {
        name: "expiry",
        type: "core::integer::u64",
      },
      {
        name: "signature",
        type: "core::array::Array::<core::felt252>",
      },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "supports_interface",
    type: "function",
    inputs: [
      {
        name: "interface_id",
        type: "core::felt252",
      },
    ],
    outputs: [
      {
        type: "core::bool",
      },
    ],
    state_mutability: "view",
  },
  {
    name: "get_reward_balance_for",
    type: "function",
    inputs: [
      {
        name: "owner",
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
    name: "reward_claim",
    type: "function",
    inputs: [],
    outputs: [],
    state_mutability: "external",
  },
] as const satisfies Abi;
