import type { Abi } from "starknet";

export const RealmsBridge = [
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
] as const satisfies Abi;
