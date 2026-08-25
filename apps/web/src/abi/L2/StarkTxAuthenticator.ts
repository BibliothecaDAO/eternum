import type { Abi } from "starknet";

export const StarkTxAuthenticator = [
  {
    name: "StarkTxAuthenticator",
    type: "impl",
    interface_name: "sx::authenticators::stark_tx::IStarkTxAuthenticator",
  },
  {
    name: "sx::types::strategy::Strategy",
    type: "struct",
    members: [
      {
        name: "address",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "params",
        type: "core::array::Array::<core::felt252>",
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
    name: "sx::types::choice::Choice",
    type: "enum",
    variants: [
      {
        name: "Against",
        type: "()",
      },
      {
        name: "For",
        type: "()",
      },
      {
        name: "Abstain",
        type: "()",
      },
    ],
  },
  {
    name: "sx::types::indexed_strategy::IndexedStrategy",
    type: "struct",
    members: [
      {
        name: "index",
        type: "core::integer::u8",
      },
      {
        name: "params",
        type: "core::array::Array::<core::felt252>",
      },
    ],
  },
  {
    name: "sx::authenticators::stark_tx::IStarkTxAuthenticator",
    type: "interface",
    items: [
      {
        name: "authenticate_propose",
        type: "function",
        inputs: [
          {
            name: "space",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "author",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "metadata_uri",
            type: "core::array::Array::<core::felt252>",
          },
          {
            name: "execution_strategy",
            type: "sx::types::strategy::Strategy",
          },
          {
            name: "user_proposal_validation_params",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "authenticate_vote",
        type: "function",
        inputs: [
          {
            name: "space",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "voter",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
          {
            name: "choice",
            type: "sx::types::choice::Choice",
          },
          {
            name: "user_voting_strategies",
            type: "core::array::Array::<sx::types::indexed_strategy::IndexedStrategy>",
          },
          {
            name: "metadata_uri",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "authenticate_update_proposal",
        type: "function",
        inputs: [
          {
            name: "space",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "author",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
          {
            name: "execution_strategy",
            type: "sx::types::strategy::Strategy",
          },
          {
            name: "metadata_uri",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    kind: "enum",
    name: "sx::authenticators::stark_tx::StarkTxAuthenticator::Event",
    type: "event",
    variants: [],
  },
] as const satisfies Abi;
