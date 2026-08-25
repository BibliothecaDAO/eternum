import type { Abi } from "starknet";

export const REALMS_TRANSFER_ABI = [
  {
    kind: "struct",
    name: "openzeppelin::token::erc721::erc721::ERC721Component::Transfer",
    type: "event",
    members: [
      {
        kind: "key",
        name: "from",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "to",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "token_id",
        type: "core::integer::u256",
      },
    ],
  },
  {
    kind: "enum",
    name: "openzeppelin::token::erc721::erc721::ERC721Component::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "Transfer",
        type: "openzeppelin::token::erc721::erc721::ERC721Component::Transfer",
      },
    ],
  },
  {
    kind: "enum",
    name: "strealm::contracts::strealm::StRealm::Event",
    type: "event",
    variants: [
      {
        kind: "flat",
        name: "ERC721Event",
        type: "openzeppelin::token::erc721::erc721::ERC721Component::Event",
      },
    ],
  },
] as const satisfies Abi;
