import type { Abi } from "starknet";

export const SnapshotSpace = [
  {
    type: "impl",
    name: "Space",
    interface_name: "sx::interfaces::i_space::ISpace",
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
    name: "sx::types::strategy::Strategy",
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
    type: "enum",
    name: "sx::types::choice::Choice",
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
    type: "struct",
    name: "core::starknet::eth_address::EthAddress",
    members: [
      {
        name: "address",
        type: "core::felt252",
      },
    ],
  },
  {
    type: "enum",
    name: "sx::types::user_address::UserAddress",
    variants: [
      {
        name: "Starknet",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "Ethereum",
        type: "core::starknet::eth_address::EthAddress",
      },
      {
        name: "Custom",
        type: "core::integer::u256",
      },
    ],
  },
  {
    type: "enum",
    name: "sx::types::finalization_status::FinalizationStatus",
    variants: [
      {
        name: "Pending",
        type: "()",
      },
      {
        name: "Executed",
        type: "()",
      },
      {
        name: "Cancelled",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "sx::types::proposal::Proposal",
    members: [
      {
        name: "start_timestamp",
        type: "core::integer::u32",
      },
      {
        name: "min_end_timestamp",
        type: "core::integer::u32",
      },
      {
        name: "max_end_timestamp",
        type: "core::integer::u32",
      },
      {
        name: "finalization_status",
        type: "sx::types::finalization_status::FinalizationStatus",
      },
      {
        name: "execution_payload_hash",
        type: "core::felt252",
      },
      {
        name: "execution_strategy",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "author",
        type: "sx::types::user_address::UserAddress",
      },
      {
        name: "active_voting_strategies",
        type: "core::integer::u256",
      },
    ],
  },
  {
    type: "enum",
    name: "sx::types::proposal_status::ProposalStatus",
    variants: [
      {
        name: "VotingDelay",
        type: "()",
      },
      {
        name: "VotingPeriod",
        type: "()",
      },
      {
        name: "VotingPeriodAccepted",
        type: "()",
      },
      {
        name: "Accepted",
        type: "()",
      },
      {
        name: "Executed",
        type: "()",
      },
      {
        name: "Rejected",
        type: "()",
      },
      {
        name: "Cancelled",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "sx::types::update_settings_calldata::UpdateSettingsCalldata",
    members: [
      {
        name: "min_voting_duration",
        type: "core::integer::u32",
      },
      {
        name: "max_voting_duration",
        type: "core::integer::u32",
      },
      {
        name: "voting_delay",
        type: "core::integer::u32",
      },
      {
        name: "metadata_uri",
        type: "core::array::Array::<core::felt252>",
      },
      {
        name: "dao_uri",
        type: "core::array::Array::<core::felt252>",
      },
      {
        name: "proposal_validation_strategy",
        type: "sx::types::strategy::Strategy",
      },
      {
        name: "proposal_validation_strategy_metadata_uri",
        type: "core::array::Array::<core::felt252>",
      },
      {
        name: "authenticators_to_add",
        type: "core::array::Array::<core::starknet::contract_address::ContractAddress>",
      },
      {
        name: "authenticators_to_remove",
        type: "core::array::Array::<core::starknet::contract_address::ContractAddress>",
      },
      {
        name: "voting_strategies_to_add",
        type: "core::array::Array::<sx::types::strategy::Strategy>",
      },
      {
        name: "voting_strategies_metadata_uris_to_add",
        type: "core::array::Array::<core::array::Array::<core::felt252>>",
      },
      {
        name: "voting_strategies_to_remove",
        type: "core::array::Array::<core::integer::u8>",
      },
    ],
  },
  {
    type: "struct",
    name: "sx::types::indexed_strategy::IndexedStrategy",
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
    type: "enum",
    name: "core::result::Result::<(), core::array::Array::<core::felt252>>",
    variants: [
      {
        name: "Ok",
        type: "()",
      },
      {
        name: "Err",
        type: "core::array::Array::<core::felt252>",
      },
    ],
  },
  {
    type: "interface",
    name: "sx::interfaces::i_space::ISpace",
    items: [
      {
        type: "function",
        name: "owner",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "voting_delay",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u32",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "min_voting_duration",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u32",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "max_voting_duration",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u32",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "dao_uri",
        inputs: [],
        outputs: [
          {
            type: "core::array::Array::<core::felt252>",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "next_proposal_id",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "authenticators",
        inputs: [
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
        name: "voting_strategies",
        inputs: [
          {
            name: "index",
            type: "core::integer::u8",
          },
        ],
        outputs: [
          {
            type: "sx::types::strategy::Strategy",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "active_voting_strategies",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "next_voting_strategy_index",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u8",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "proposal_validation_strategy",
        inputs: [],
        outputs: [
          {
            type: "sx::types::strategy::Strategy",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "vote_power",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
          {
            name: "choice",
            type: "sx::types::choice::Choice",
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
        type: "function",
        name: "vote_registry",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
          {
            name: "voter",
            type: "sx::types::user_address::UserAddress",
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
        name: "proposals",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "sx::types::proposal::Proposal",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_proposal_status",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "sx::types::proposal_status::ProposalStatus",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "update_settings",
        inputs: [
          {
            name: "input",
            type: "sx::types::update_settings_calldata::UpdateSettingsCalldata",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "transfer_ownership",
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
        type: "function",
        name: "renounce_ownership",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "initialize",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "min_voting_duration",
            type: "core::integer::u32",
          },
          {
            name: "max_voting_duration",
            type: "core::integer::u32",
          },
          {
            name: "voting_delay",
            type: "core::integer::u32",
          },
          {
            name: "proposal_validation_strategy",
            type: "sx::types::strategy::Strategy",
          },
          {
            name: "proposal_validation_strategy_metadata_uri",
            type: "core::array::Array::<core::felt252>",
          },
          {
            name: "voting_strategies",
            type: "core::array::Array::<sx::types::strategy::Strategy>",
          },
          {
            name: "voting_strategy_metadata_uris",
            type: "core::array::Array::<core::array::Array::<core::felt252>>",
          },
          {
            name: "authenticators",
            type: "core::array::Array::<core::starknet::contract_address::ContractAddress>",
          },
          {
            name: "metadata_uri",
            type: "core::array::Array::<core::felt252>",
          },
          {
            name: "dao_uri",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "propose",
        inputs: [
          {
            name: "author",
            type: "sx::types::user_address::UserAddress",
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
        type: "function",
        name: "vote",
        inputs: [
          {
            name: "voter",
            type: "sx::types::user_address::UserAddress",
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
        type: "function",
        name: "execute",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
          {
            name: "execution_payload",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "update_proposal",
        inputs: [
          {
            name: "author",
            type: "sx::types::user_address::UserAddress",
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
      {
        type: "function",
        name: "cancel",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "upgrade",
        inputs: [
          {
            name: "class_hash",
            type: "core::starknet::class_hash::ClassHash",
          },
          {
            name: "initialize_calldata",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [
          {
            type: "core::result::Result::<(), core::array::Array::<core::felt252>>",
          },
        ],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "post_upgrade_initializer",
        inputs: [
          {
            name: "initialize_calldata",
            type: "core::array::Array::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<core::felt252>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::felt252>",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<sx::types::strategy::Strategy>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<sx::types::strategy::Strategy>",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<core::array::Array::<core::felt252>>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::array::Array::<core::felt252>>",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::starknet::contract_address::ContractAddress>",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::SpaceCreated",
    kind: "struct",
    members: [
      {
        name: "space",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "min_voting_duration",
        type: "core::integer::u32",
        kind: "data",
      },
      {
        name: "max_voting_duration",
        type: "core::integer::u32",
        kind: "data",
      },
      {
        name: "voting_delay",
        type: "core::integer::u32",
        kind: "data",
      },
      {
        name: "proposal_validation_strategy",
        type: "sx::types::strategy::Strategy",
        kind: "data",
      },
      {
        name: "proposal_validation_strategy_metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
      {
        name: "voting_strategies",
        type: "core::array::Span::<sx::types::strategy::Strategy>",
        kind: "data",
      },
      {
        name: "voting_strategy_metadata_uris",
        type: "core::array::Span::<core::array::Array::<core::felt252>>",
        kind: "data",
      },
      {
        name: "authenticators",
        type: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
        kind: "data",
      },
      {
        name: "metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
      {
        name: "dao_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::ProposalCreated",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "author",
        type: "sx::types::user_address::UserAddress",
        kind: "data",
      },
      {
        name: "proposal",
        type: "sx::types::proposal::Proposal",
        kind: "data",
      },
      {
        name: "metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
      {
        name: "payload",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::VoteCast",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "voter",
        type: "sx::types::user_address::UserAddress",
        kind: "data",
      },
      {
        name: "choice",
        type: "sx::types::choice::Choice",
        kind: "data",
      },
      {
        name: "voting_power",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::ProposalExecuted",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::ProposalUpdated",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "execution_strategy",
        type: "sx::types::strategy::Strategy",
        kind: "data",
      },
      {
        name: "metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::ProposalCancelled",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u256",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::VotingStrategiesAdded",
    kind: "struct",
    members: [
      {
        name: "voting_strategies",
        type: "core::array::Span::<sx::types::strategy::Strategy>",
        kind: "data",
      },
      {
        name: "voting_strategy_metadata_uris",
        type: "core::array::Span::<core::array::Array::<core::felt252>>",
        kind: "data",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<core::integer::u8>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::integer::u8>",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::VotingStrategiesRemoved",
    kind: "struct",
    members: [
      {
        name: "voting_strategy_indices",
        type: "core::array::Span::<core::integer::u8>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::AuthenticatorsAdded",
    kind: "struct",
    members: [
      {
        name: "authenticators",
        type: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::AuthenticatorsRemoved",
    kind: "struct",
    members: [
      {
        name: "authenticators",
        type: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::MetadataUriUpdated",
    kind: "struct",
    members: [
      {
        name: "metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::DaoUriUpdated",
    kind: "struct",
    members: [
      {
        name: "dao_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::MaxVotingDurationUpdated",
    kind: "struct",
    members: [
      {
        name: "max_voting_duration",
        type: "core::integer::u32",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::MinVotingDurationUpdated",
    kind: "struct",
    members: [
      {
        name: "min_voting_duration",
        type: "core::integer::u32",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::ProposalValidationStrategyUpdated",
    kind: "struct",
    members: [
      {
        name: "proposal_validation_strategy",
        type: "sx::types::strategy::Strategy",
        kind: "data",
      },
      {
        name: "proposal_validation_strategy_metadata_uri",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::VotingDelayUpdated",
    kind: "struct",
    members: [
      {
        name: "voting_delay",
        type: "core::integer::u32",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::Upgraded",
    kind: "struct",
    members: [
      {
        name: "class_hash",
        type: "core::starknet::class_hash::ClassHash",
        kind: "data",
      },
      {
        name: "initialize_calldata",
        type: "core::array::Span::<core::felt252>",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "sx::space::space::Space::Event",
    kind: "enum",
    variants: [
      {
        name: "SpaceCreated",
        type: "sx::space::space::Space::SpaceCreated",
        kind: "nested",
      },
      {
        name: "ProposalCreated",
        type: "sx::space::space::Space::ProposalCreated",
        kind: "nested",
      },
      {
        name: "VoteCast",
        type: "sx::space::space::Space::VoteCast",
        kind: "nested",
      },
      {
        name: "ProposalExecuted",
        type: "sx::space::space::Space::ProposalExecuted",
        kind: "nested",
      },
      {
        name: "ProposalUpdated",
        type: "sx::space::space::Space::ProposalUpdated",
        kind: "nested",
      },
      {
        name: "ProposalCancelled",
        type: "sx::space::space::Space::ProposalCancelled",
        kind: "nested",
      },
      {
        name: "VotingStrategiesAdded",
        type: "sx::space::space::Space::VotingStrategiesAdded",
        kind: "nested",
      },
      {
        name: "VotingStrategiesRemoved",
        type: "sx::space::space::Space::VotingStrategiesRemoved",
        kind: "nested",
      },
      {
        name: "AuthenticatorsAdded",
        type: "sx::space::space::Space::AuthenticatorsAdded",
        kind: "nested",
      },
      {
        name: "AuthenticatorsRemoved",
        type: "sx::space::space::Space::AuthenticatorsRemoved",
        kind: "nested",
      },
      {
        name: "MetadataUriUpdated",
        type: "sx::space::space::Space::MetadataUriUpdated",
        kind: "nested",
      },
      {
        name: "DaoUriUpdated",
        type: "sx::space::space::Space::DaoUriUpdated",
        kind: "nested",
      },
      {
        name: "MaxVotingDurationUpdated",
        type: "sx::space::space::Space::MaxVotingDurationUpdated",
        kind: "nested",
      },
      {
        name: "MinVotingDurationUpdated",
        type: "sx::space::space::Space::MinVotingDurationUpdated",
        kind: "nested",
      },
      {
        name: "ProposalValidationStrategyUpdated",
        type: "sx::space::space::Space::ProposalValidationStrategyUpdated",
        kind: "nested",
      },
      {
        name: "VotingDelayUpdated",
        type: "sx::space::space::Space::VotingDelayUpdated",
        kind: "nested",
      },
      {
        name: "Upgraded",
        type: "sx::space::space::Space::Upgraded",
        kind: "nested",
      },
    ],
  },
] as const satisfies Abi;
