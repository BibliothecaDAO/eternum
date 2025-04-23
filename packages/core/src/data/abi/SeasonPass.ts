import type { Abi } from "starknet";

export const SeasonPassAbi = [
  { type: "impl", name: "UpgradeableImpl", interface_name: "openzeppelin_upgrades::interface::IUpgradeable" },
  {
    type: "interface",
    name: "openzeppelin_upgrades::interface::IUpgradeable",
    items: [
      {
        type: "function",
        name: "upgrade",
        inputs: [{ name: "new_class_hash", type: "core::starknet::class_hash::ClassHash" }],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  { type: "impl", name: "ERC721Metadata", interface_name: "openzeppelin_token::erc721::interface::IERC721Metadata" },
  {
    type: "struct",
    name: "core::byte_array::ByteArray",
    members: [
      { name: "data", type: "core::array::Array::<core::bytes_31::bytes31>" },
      { name: "pending_word", type: "core::felt252" },
      { name: "pending_word_len", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "interface",
    name: "openzeppelin_token::erc721::interface::IERC721Metadata",
    items: [
      {
        type: "function",
        name: "name",
        inputs: [],
        outputs: [{ type: "core::byte_array::ByteArray" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "symbol",
        inputs: [],
        outputs: [{ type: "core::byte_array::ByteArray" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "token_uri",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::byte_array::ByteArray" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "impl",
    name: "ERC721MetadataCamelOnly",
    interface_name: "openzeppelin_token::erc721::interface::IERC721MetadataCamelOnly",
  },
  {
    type: "interface",
    name: "openzeppelin_token::erc721::interface::IERC721MetadataCamelOnly",
    items: [
      {
        type: "function",
        name: "tokenURI",
        inputs: [{ name: "tokenId", type: "core::integer::u256" }],
        outputs: [{ type: "core::byte_array::ByteArray" }],
        state_mutability: "view",
      },
    ],
  },
  { type: "impl", name: "RealmMetadataEncodedImpl", interface_name: "esp::contract::IRealmMetadataEncoded" },
  {
    type: "interface",
    name: "esp::contract::IRealmMetadataEncoded",
    items: [
      {
        type: "function",
        name: "get_encoded_metadata",
        inputs: [{ name: "token_id", type: "core::integer::u16" }],
        outputs: [{ type: "(core::felt252, core::felt252, core::felt252)" }],
        state_mutability: "view",
      },
    ],
  },
  { type: "impl", name: "SeasonPassImpl", interface_name: "esp::contract::ISeasonPass" },
  {
    type: "interface",
    name: "esp::contract::ISeasonPass",
    items: [
      {
        type: "function",
        name: "mint",
        inputs: [
          { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
          { name: "token_id", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "attach_lords",
        inputs: [
          { name: "token_id", type: "core::integer::u256" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "detach_lords",
        inputs: [
          { name: "token_id", type: "core::integer::u256" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "lords_balance",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
    ],
  },
  { type: "impl", name: "ERC721Impl", interface_name: "openzeppelin_token::erc721::interface::IERC721" },
  {
    type: "struct",
    name: "core::array::Span::<core::felt252>",
    members: [{ name: "snapshot", type: "@core::array::Array::<core::felt252>" }],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      { name: "False", type: "()" },
      { name: "True", type: "()" },
    ],
  },
  {
    type: "interface",
    name: "openzeppelin_token::erc721::interface::IERC721",
    items: [
      {
        type: "function",
        name: "balance_of",
        inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "owner_of",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "safe_transfer_from",
        inputs: [
          { name: "from", type: "core::starknet::contract_address::ContractAddress" },
          { name: "to", type: "core::starknet::contract_address::ContractAddress" },
          { name: "token_id", type: "core::integer::u256" },
          { name: "data", type: "core::array::Span::<core::felt252>" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "transfer_from",
        inputs: [
          { name: "from", type: "core::starknet::contract_address::ContractAddress" },
          { name: "to", type: "core::starknet::contract_address::ContractAddress" },
          { name: "token_id", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "approve",
        inputs: [
          { name: "to", type: "core::starknet::contract_address::ContractAddress" },
          { name: "token_id", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_approval_for_all",
        inputs: [
          { name: "operator", type: "core::starknet::contract_address::ContractAddress" },
          { name: "approved", type: "core::bool" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_approved",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_approved_for_all",
        inputs: [
          { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
          { name: "operator", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
    ],
  },
  { type: "impl", name: "OwnableImpl", interface_name: "openzeppelin_access::ownable::interface::IOwnable" },
  {
    type: "interface",
    name: "openzeppelin_access::ownable::interface::IOwnable",
    items: [
      {
        type: "function",
        name: "owner",
        inputs: [],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "transfer_ownership",
        inputs: [{ name: "new_owner", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [],
        state_mutability: "external",
      },
      { type: "function", name: "renounce_ownership", inputs: [], outputs: [], state_mutability: "external" },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
      { name: "realms_contract_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "lords_contract_address", type: "core::starknet::contract_address::ContractAddress" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_token::erc721::erc721::ERC721Component::Transfer",
    kind: "struct",
    members: [
      { name: "from", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "to", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "token_id", type: "core::integer::u256", kind: "key" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_token::erc721::erc721::ERC721Component::Approval",
    kind: "struct",
    members: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "approved", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "token_id", type: "core::integer::u256", kind: "key" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_token::erc721::erc721::ERC721Component::ApprovalForAll",
    kind: "struct",
    members: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "operator", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "approved", type: "core::bool", kind: "data" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_token::erc721::erc721::ERC721Component::Event",
    kind: "enum",
    variants: [
      { name: "Transfer", type: "openzeppelin_token::erc721::erc721::ERC721Component::Transfer", kind: "nested" },
      { name: "Approval", type: "openzeppelin_token::erc721::erc721::ERC721Component::Approval", kind: "nested" },
      {
        name: "ApprovalForAll",
        type: "openzeppelin_token::erc721::erc721::ERC721Component::ApprovalForAll",
        kind: "nested",
      },
    ],
  },
  { type: "event", name: "openzeppelin_introspection::src5::SRC5Component::Event", kind: "enum", variants: [] },
  {
    type: "event",
    name: "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
    kind: "struct",
    members: [
      { name: "previous_owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "new_owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
    kind: "struct",
    members: [
      { name: "previous_owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
      { name: "new_owner", type: "core::starknet::contract_address::ContractAddress", kind: "key" },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
    kind: "enum",
    variants: [
      {
        name: "OwnershipTransferred",
        type: "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
        kind: "nested",
      },
      {
        name: "OwnershipTransferStarted",
        type: "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
        kind: "nested",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded",
    kind: "struct",
    members: [{ name: "class_hash", type: "core::starknet::class_hash::ClassHash", kind: "data" }],
  },
  {
    type: "event",
    name: "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event",
    kind: "enum",
    variants: [
      { name: "Upgraded", type: "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded", kind: "nested" },
    ],
  },
  {
    type: "event",
    name: "esp::contract::EternumSeasonPass::Event",
    kind: "enum",
    variants: [
      { name: "ERC721Event", type: "openzeppelin_token::erc721::erc721::ERC721Component::Event", kind: "flat" },
      { name: "SRC5Event", type: "openzeppelin_introspection::src5::SRC5Component::Event", kind: "flat" },
      { name: "OwnableEvent", type: "openzeppelin_access::ownable::ownable::OwnableComponent::Event", kind: "flat" },
      {
        name: "UpgradeableEvent",
        type: "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event",
        kind: "flat",
      },
    ],
  },
] as const satisfies Abi;
