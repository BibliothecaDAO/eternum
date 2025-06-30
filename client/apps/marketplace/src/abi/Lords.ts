export const LordsAbi = [
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
  { type: "impl", name: "ERC20Impl", interface_name: "openzeppelin_token::erc20::interface::IERC20" },
  {
    type: "interface",
    name: "openzeppelin_token::erc20::interface::IERC20",
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
        name: "decimals",
        inputs: [],
        outputs: [{ type: "core::integer::u8" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "total_supply",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "balance_of",
        inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "allowance",
        inputs: [
          { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
          { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "transfer",
        inputs: [
          { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "transfer_from",
        inputs: [
          { name: "sender", type: "core::starknet::contract_address::ContractAddress" },
          { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "approve",
        inputs: [
          { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "impl",
    name: "ERC20MetadataCamelOnlyImpl",
    interface_name: "openzeppelin_token::erc20::interface::IERC20MetadataCamelOnly",
  },
  {
    type: "interface",
    name: "openzeppelin_token::erc20::interface::IERC20MetadataCamelOnly",
    items: [
      {
        type: "function",
        name: "totalSupply",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "allowance",
        inputs: [
          { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
          { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [{ type: "core::integer::u256" }],
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
      {
        type: "function",
        name: "renounce_ownership",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  { type: "impl", name: "PausableImpl", interface_name: "openzeppelin_security::pausable::interface::IPausable" },
  {
    type: "interface",
    name: "openzeppelin_security::pausable::interface::IPausable",
    items: [
      {
        type: "function",
        name: "paused",
        inputs: [],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "pause",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "unpause",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  { type: "impl", name: "LordsImpl", interface_name: "esp::contract::ILords" },
  {
    type: "interface",
    name: "esp::contract::ILords",
    items: [
      {
        type: "function",
        name: "mint_test_lords",
        inputs: [
          { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
] as const;

export const abi = LordsAbi;
