// Vendored from contracts/ledger target build (scarb build → game_ledger_GameLedger.contract_class.json).
// The source of truth is contracts/ledger/src/contract.cairo on this branch; regenerate by
// rebuilding the contract and re-extracting the "abi" field. B.1 froze this interface.
export const GAME_LEDGER_ABI = [
  {
    type: "impl",
    name: "GameLedgerImpl",
    interface_name: "game_ledger::contract::IGameLedger",
  },
  {
    type: "struct",
    name: "core::integer::u256",
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
    type: "enum",
    name: "core::bool",
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
    type: "struct",
    name: "game_ledger::types::MmrParams",
    members: [
      {
        name: "enabled",
        type: "core::bool",
      },
      {
        name: "mean",
        type: "core::integer::u16",
      },
      {
        name: "spread",
        type: "core::integer::u16",
      },
      {
        name: "max_delta",
        type: "core::integer::u8",
      },
      {
        name: "k",
        type: "core::integer::u8",
      },
      {
        name: "regression_bps",
        type: "core::integer::u16",
      },
      {
        name: "min_players",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "game_ledger::types::PmParams",
    members: [
      {
        name: "fee_bps",
        type: "core::integer::u16",
      },
      {
        name: "liability_cap",
        type: "core::integer::u256",
      },
      {
        name: "seed",
        type: "core::integer::u256",
      },
      {
        name: "claim_window_seconds",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "game_ledger::types::Preset",
    members: [
      {
        name: "entry_fee",
        type: "core::integer::u256",
      },
      {
        name: "protocol_cut_bps",
        type: "core::integer::u16",
      },
      {
        name: "paid_fraction_bps",
        type: "core::integer::u16",
      },
      {
        name: "decay_bps",
        type: "core::integer::u16",
      },
      {
        name: "sword_price",
        type: "core::integer::u256",
      },
      {
        name: "shield_price",
        type: "core::integer::u256",
      },
      {
        name: "mmr",
        type: "game_ledger::types::MmrParams",
      },
      {
        name: "pm",
        type: "game_ledger::types::PmParams",
      },
    ],
  },
  {
    type: "struct",
    name: "game_ledger::types::Game",
    members: [
      {
        name: "exists",
        type: "core::bool",
      },
      {
        name: "preset_id",
        type: "core::integer::u32",
      },
      {
        name: "start",
        type: "core::integer::u64",
      },
      {
        name: "end",
        type: "core::integer::u64",
      },
      {
        name: "pool",
        type: "core::integer::u256",
      },
      {
        name: "registered_count",
        type: "core::integer::u16",
      },
      {
        name: "cancelled",
        type: "core::bool",
      },
      {
        name: "finalized",
        type: "core::bool",
      },
      {
        name: "protocol_cut",
        type: "core::integer::u256",
      },
      {
        name: "dust",
        type: "core::integer::u256",
      },
    ],
  },
  {
    type: "struct",
    name: "game_ledger::types::Registration",
    members: [
      {
        name: "registered",
        type: "core::bool",
      },
      {
        name: "sword",
        type: "core::bool",
      },
      {
        name: "shield",
        type: "core::bool",
      },
      {
        name: "flags_consumed",
        type: "core::bool",
      },
      {
        name: "paid",
        type: "core::integer::u256",
      },
      {
        name: "realm_id",
        type: "core::integer::u256",
      },
    ],
  },
  {
    type: "struct",
    name: "game_ledger::types::PlayerResult",
    members: [
      {
        name: "rank",
        type: "core::integer::u16",
      },
      {
        name: "chests",
        type: "core::integer::u16",
      },
      {
        name: "payout",
        type: "core::integer::u256",
      },
      {
        name: "mmr_before",
        type: "core::integer::u128",
      },
      {
        name: "mmr_after",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "interface",
    name: "game_ledger::contract::IGameLedger",
    items: [
      {
        type: "function",
        name: "register_preset",
        inputs: [
          {
            name: "preset_id",
            type: "core::integer::u32",
          },
          {
            name: "preset",
            type: "game_ledger::types::Preset",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_messaging",
        inputs: [
          {
            name: "core_contract",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "l3_entry_system",
            type: "core::felt252",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "open_game",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "preset_id",
            type: "core::integer::u32",
          },
          {
            name: "start",
            type: "core::integer::u64",
          },
          {
            name: "end",
            type: "core::integer::u64",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "register",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "sword",
            type: "core::bool",
          },
          {
            name: "shield",
            type: "core::bool",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "register_with_pass",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "pass_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "register_village",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "village_pass_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "fund",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "cancel_game",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "refund",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "apply_results",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "ranked",
            type: "core::array::Array::<(core::starknet::contract_address::ContractAddress, core::integer::u16, core::integer::u16)>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_preset",
        inputs: [
          {
            name: "preset_id",
            type: "core::integer::u32",
          },
        ],
        outputs: [
          {
            type: "game_ledger::types::Preset",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_game",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
        ],
        outputs: [
          {
            type: "game_ledger::types::Game",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_registration",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "game_ledger::types::Registration",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_registered_owner",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "index",
            type: "core::integer::u16",
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
        type: "function",
        name: "get_player_result",
        inputs: [
          {
            name: "game_id",
            type: "core::integer::u32",
          },
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "game_ledger::types::PlayerResult",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "impl",
    name: "AccessControlMixinImpl",
    interface_name: "openzeppelin_access::accesscontrol::interface::AccessControlABI",
  },
  {
    type: "interface",
    name: "openzeppelin_access::accesscontrol::interface::AccessControlABI",
    items: [
      {
        type: "function",
        name: "has_role",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
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
        type: "function",
        name: "get_role_admin",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "grant_role",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "revoke_role",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "renounce_role",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "hasRole",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
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
        type: "function",
        name: "getRoleAdmin",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "grantRole",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "revokeRole",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "renounceRole",
        inputs: [
          {
            name: "role",
            type: "core::felt252",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "supports_interface",
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
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      {
        name: "admin",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "operator",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "treasury",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "lords",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "mmr_token",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "season_pass",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "village_pass",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "loot_chest",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "elite_invite",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "cosmetics",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_introspection::src5::SRC5Component::Event",
    kind: "enum",
    variants: [],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "previous_admin_role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "new_admin_role",
        type: "core::felt252",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
    kind: "enum",
    variants: [
      {
        name: "RoleGranted",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
        kind: "nested",
      },
      {
        name: "RoleRevoked",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
        kind: "nested",
      },
      {
        name: "RoleAdminChanged",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
        kind: "nested",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::PresetRegistered",
    kind: "struct",
    members: [
      {
        name: "preset_id",
        type: "core::integer::u32",
        kind: "key",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::GameOpened",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
      {
        name: "preset_id",
        type: "core::integer::u32",
        kind: "data",
      },
      {
        name: "start",
        type: "core::integer::u64",
        kind: "data",
      },
      {
        name: "end",
        type: "core::integer::u64",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::Registered",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "realm_id",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "metadata",
        type: "(core::felt252, core::felt252, core::felt252)",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::Funded",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
      {
        name: "funder",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "amount",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::GameCancelled",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::Refunded",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "amount",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::PlayerPaid",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      {
        name: "rank",
        type: "core::integer::u16",
        kind: "data",
      },
      {
        name: "amount",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::ResultsApplied",
    kind: "struct",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
        kind: "key",
      },
      {
        name: "pool",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "protocol_cut",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "dust",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::MessagingConfigured",
    kind: "struct",
    members: [
      {
        name: "core_contract",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "l3_entry_system",
        type: "core::felt252",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "game_ledger::contract::GameLedger::Event",
    kind: "enum",
    variants: [
      {
        name: "SRC5Event",
        type: "openzeppelin_introspection::src5::SRC5Component::Event",
        kind: "flat",
      },
      {
        name: "AccessControlEvent",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
        kind: "flat",
      },
      {
        name: "PresetRegistered",
        type: "game_ledger::contract::GameLedger::PresetRegistered",
        kind: "nested",
      },
      {
        name: "GameOpened",
        type: "game_ledger::contract::GameLedger::GameOpened",
        kind: "nested",
      },
      {
        name: "Registered",
        type: "game_ledger::contract::GameLedger::Registered",
        kind: "nested",
      },
      {
        name: "Funded",
        type: "game_ledger::contract::GameLedger::Funded",
        kind: "nested",
      },
      {
        name: "GameCancelled",
        type: "game_ledger::contract::GameLedger::GameCancelled",
        kind: "nested",
      },
      {
        name: "Refunded",
        type: "game_ledger::contract::GameLedger::Refunded",
        kind: "nested",
      },
      {
        name: "PlayerPaid",
        type: "game_ledger::contract::GameLedger::PlayerPaid",
        kind: "nested",
      },
      {
        name: "ResultsApplied",
        type: "game_ledger::contract::GameLedger::ResultsApplied",
        kind: "nested",
      },
      {
        name: "MessagingConfigured",
        type: "game_ledger::contract::GameLedger::MessagingConfigured",
        kind: "nested",
      },
    ],
  },
] as const;
