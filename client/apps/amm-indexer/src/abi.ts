import type { Abi } from "@apibara/starknet";

/**
 * AMM ABI for event decoding.
 *
 * Event layout from Cairo contract:
 * - #[key] fields go into event keys (topics)
 * - Non-key fields go into event data
 * - u256 is represented as core::integer::u256
 * - ContractAddress is core::starknet::contract_address::ContractAddress
 */
export const ammAbi = [
  // Top-level Event enum
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::Event",
    kind: "enum",
    variants: [
      {
        name: "PoolCreated",
        type: "eternum_amm::amm::EternumAMM::PoolCreated",
        kind: "nested",
      },
      {
        name: "LiquidityAdded",
        type: "eternum_amm::amm::EternumAMM::LiquidityAdded",
        kind: "nested",
      },
      {
        name: "LiquidityRemoved",
        type: "eternum_amm::amm::EternumAMM::LiquidityRemoved",
        kind: "nested",
      },
      {
        name: "Swap",
        type: "eternum_amm::amm::EternumAMM::Swap",
        kind: "nested",
      },
      {
        name: "PoolFeeChanged",
        type: "eternum_amm::amm::EternumAMM::PoolFeeChanged",
        kind: "nested",
      },
      {
        name: "FeeRecipientChanged",
        type: "eternum_amm::amm::EternumAMM::FeeRecipientChanged",
        kind: "nested",
      },
    ],
  },

  // PoolCreated: #[key] token, data: lp_token, lp_fee_num, lp_fee_denom, protocol_fee_num, protocol_fee_denom
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::PoolCreated",
    kind: "struct",
    members: [
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "lp_token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "lp_fee_num",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "lp_fee_denom",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "protocol_fee_num",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "protocol_fee_denom",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },

  // LiquidityAdded: #[key] token, #[key] provider, data: lords_amount, token_amount, lp_minted
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::LiquidityAdded",
    kind: "struct",
    members: [
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "provider",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "lords_amount",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "token_amount",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "lp_minted",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },

  // LiquidityRemoved: #[key] token, #[key] provider, data: lords_amount, token_amount, lp_burned
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::LiquidityRemoved",
    kind: "struct",
    members: [
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "provider",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "lords_amount",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "token_amount",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "lp_burned",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },

  // Swap: #[key] user, data: token_in, token_out, amount_in, amount_out, protocol_fee
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::Swap",
    kind: "struct",
    members: [
      {
        name: "user",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "token_in",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "token_out",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "amount_in",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "amount_out",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "protocol_fee",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },

  // PoolFeeChanged: #[key] token, data: lp_fee_num, lp_fee_denom, protocol_fee_num, protocol_fee_denom
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::PoolFeeChanged",
    kind: "struct",
    members: [
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "lp_fee_num",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "lp_fee_denom",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "protocol_fee_num",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "protocol_fee_denom",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },

  // FeeRecipientChanged: data: old_recipient, new_recipient (no keys)
  {
    type: "event",
    name: "eternum_amm::amm::EternumAMM::FeeRecipientChanged",
    kind: "struct",
    members: [
      {
        name: "old_recipient",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "new_recipient",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
] as const satisfies Abi;

/** Event name constants for selector computation */
export const EVENT_NAME = {
  PoolCreated: "eternum_amm::amm::EternumAMM::PoolCreated",
  LiquidityAdded: "eternum_amm::amm::EternumAMM::LiquidityAdded",
  LiquidityRemoved: "eternum_amm::amm::EternumAMM::LiquidityRemoved",
  Swap: "eternum_amm::amm::EternumAMM::Swap",
  PoolFeeChanged: "eternum_amm::amm::EternumAMM::PoolFeeChanged",
  FeeRecipientChanged: "eternum_amm::amm::EternumAMM::FeeRecipientChanged",
} as const;
