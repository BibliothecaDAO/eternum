//import type { ApibaraRuntimeConfig } from "apibara/types";
import type {
  ExtractTablesWithRelations,
  TablesRelationalConfig,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Abi } from "starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import { decodeEvent, getSelector, StarknetStream } from "@apibara/starknet";

import { ChainId, CollectionAddresses } from "@realms-world/constants";
import { db } from "@realms-world/db/poolClient";
import { realmsLordsClaims } from "@realms-world/db/schema";

import { env } from "../env";

export default function (/*runtimeConfig: ApibaraRuntimeConfig*/) {
  return createIndexer({ database: db });
}
const l2ChainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends
    TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  return defineIndexer(StarknetStream)({
    streamUrl:
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? "https://starknet-sepolia.preview.apibara.org"
        : "https://starknet.preview.apibara.org",

    finality: "pending",
    startingCursor: {
      orderKey: env.VITE_PUBLIC_CHAIN === "sepolia" ? 76_103n : 664_161n,
    },
    filter: {
      events: [
        {
          address: CollectionAddresses.realms[l2ChainId] as `0x${string}`,
          keys: [getSelector("RewardClaimed")],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        idColumn: "_id",
        persistState: true,
        indexerName: "starknet-realms-lords-claims",
      }),
    ],
    async transform({ endCursor, block, finality }) {
      const logger = useLogger();
      const { db } = useDrizzleStorage();
      const { events } = block;

      logger.info(
        "Transforming block | orderKey: ",
        endCursor?.orderKey,
        " | finality: ",
        finality,
      );

      for (const event of events) {
        const { args, transactionHash } = decodeEvent({
          abi: REALMS_ABI,
          eventName:
            "strealm::components::strealm::StRealmComponent::RewardClaimed",
          event,
        });

        await db
          .insert(realmsLordsClaims)
          .values({
            _id: transactionHash,
            hash: transactionHash,
            recipient: args.recipient,
            amount: args.amount,
            timestamp: block.header.timestamp,
          })
          .onConflictDoNothing();
      }
    },
  });
}

export const REALMS_ABI = [
  {
    name: "ERC721Metadata",
    type: "impl",
    interface_name: "openzeppelin::token::erc721::interface::IERC721Metadata",
  },
  {
    name: "core::byte_array::ByteArray",
    type: "struct",
    members: [
      {
        name: "data",
        type: "core::array::Array::<core::bytes_31::bytes31>",
      },
      {
        name: "pending_word",
        type: "core::felt252",
      },
      {
        name: "pending_word_len",
        type: "core::integer::u32",
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
    name: "openzeppelin::token::erc721::interface::IERC721Metadata",
    type: "interface",
    items: [
      {
        name: "name",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "symbol",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "token_uri",
        type: "function",
        inputs: [
          {
            name: "token_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    name: "ERC721MetadataCamelOnly",
    type: "impl",
    interface_name:
      "openzeppelin::token::erc721::interface::IERC721MetadataCamelOnly",
  },
  {
    name: "openzeppelin::token::erc721::interface::IERC721MetadataCamelOnly",
    type: "interface",
    items: [
      {
        name: "tokenURI",
        type: "function",
        inputs: [
          {
            name: "tokenId",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    name: "RealmMetadataEncoded",
    type: "impl",
    interface_name:
      "strealm::contracts::metadata::metadata::IRealmMetadataEncoded",
  },
  {
    name: "strealm::contracts::metadata::metadata::IRealmMetadataEncoded",
    type: "interface",
    items: [
      {
        name: "get_encoded_metadata",
        type: "function",
        inputs: [
          {
            name: "token_id",
            type: "core::integer::u16",
          },
        ],
        outputs: [
          {
            type: "(core::felt252, core::felt252, core::felt252)",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_decoded_metadata",
        type: "function",
        inputs: [
          {
            name: "token_id",
            type: "core::integer::u16",
          },
        ],
        outputs: [
          {
            type: "core::byte_array::ByteArray",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    name: "RealmMetadata",
    type: "impl",
    interface_name: "strealm::contracts::strealm::IRealmMetadata",
  },
  {
    name: "strealm::contracts::strealm::IRealmMetadata",
    type: "interface",
    items: [
      {
        name: "get_metadata_address",
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
        name: "set_metadata_address",
        type: "function",
        inputs: [
          {
            name: "contract_address",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
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
    name: "ERC721MinterBurnerImpl",
    type: "impl",
    interface_name: "strealm::contracts::strealm::IERC721MinterBurner",
  },
  {
    name: "core::array::Span::<core::felt252>",
    type: "struct",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::felt252>",
      },
    ],
  },
  {
    name: "strealm::contracts::strealm::IERC721MinterBurner",
    type: "interface",
    items: [
      {
        name: "burn",
        type: "function",
        inputs: [
          {
            name: "token_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "safe_mint",
        type: "function",
        inputs: [
          {
            name: "recipient",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "token_id",
            type: "core::integer::u256",
          },
          {
            name: "data",
            type: "core::array::Span::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "ERC721VotesComponentImpl",
    type: "impl",
    interface_name:
      "openzeppelin::governance::utils::interfaces::votes::IVotes",
  },
  {
    name: "openzeppelin::governance::utils::interfaces::votes::IVotes",
    type: "interface",
    items: [
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
    ],
  },
  {
    name: "ERC721Impl",
    type: "impl",
    interface_name: "openzeppelin::token::erc721::interface::IERC721",
  },
  {
    name: "core::bool",
    type: "enum",
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
    name: "openzeppelin::token::erc721::interface::IERC721",
    type: "interface",
    items: [
      {
        name: "balance_of",
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
        name: "owner_of",
        type: "function",
        inputs: [
          {
            name: "token_id",
            type: "core::integer::u256",
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
        name: "safe_transfer_from",
        type: "function",
        inputs: [
          {
            name: "from",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "to",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "token_id",
            type: "core::integer::u256",
          },
          {
            name: "data",
            type: "core::array::Span::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "transfer_from",
        type: "function",
        inputs: [
          {
            name: "from",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "to",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "token_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "approve",
        type: "function",
        inputs: [
          {
            name: "to",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "token_id",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "set_approval_for_all",
        type: "function",
        inputs: [
          {
            name: "operator",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "approved",
            type: "core::bool",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "get_approved",
        type: "function",
        inputs: [
          {
            name: "token_id",
            type: "core::integer::u256",
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
        name: "is_approved_for_all",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "operator",
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
    ],
  },
  {
    name: "ERC721CamelOnlyImpl",
    type: "impl",
    interface_name: "openzeppelin::token::erc721::interface::IERC721CamelOnly",
  },
  {
    name: "openzeppelin::token::erc721::interface::IERC721CamelOnly",
    type: "interface",
    items: [
      {
        name: "balanceOf",
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
        name: "ownerOf",
        type: "function",
        inputs: [
          {
            name: "tokenId",
            type: "core::integer::u256",
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
        name: "safeTransferFrom",
        type: "function",
        inputs: [
          {
            name: "from",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "to",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "tokenId",
            type: "core::integer::u256",
          },
          {
            name: "data",
            type: "core::array::Span::<core::felt252>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "transferFrom",
        type: "function",
        inputs: [
          {
            name: "from",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "to",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "tokenId",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "setApprovalForAll",
        type: "function",
        inputs: [
          {
            name: "operator",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "approved",
            type: "core::bool",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "getApproved",
        type: "function",
        inputs: [
          {
            name: "tokenId",
            type: "core::integer::u256",
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
        name: "isApprovedForAll",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "operator",
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
    ],
  },
  {
    name: "SRC5Impl",
    type: "impl",
    interface_name: "openzeppelin::introspection::interface::ISRC5",
  },
  {
    name: "openzeppelin::introspection::interface::ISRC5",
    type: "interface",
    items: [
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
    ],
  },
  {
    name: "NoncesImpl",
    type: "impl",
    interface_name: "openzeppelin::utils::cryptography::interface::INonces",
  },
  {
    name: "openzeppelin::utils::cryptography::interface::INonces",
    type: "interface",
    items: [
      {
        name: "nonces",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    name: "StRealmComponentImpl",
    type: "impl",
    interface_name: "strealm::components::strealm::IStRealm",
  },
  {
    name: "strealm::components::strealm::strealm_structs::Stream",
    type: "struct",
    members: [
      {
        name: "flow_id",
        type: "core::integer::u64",
      },
      {
        name: "start_at",
        type: "core::integer::u64",
      },
    ],
  },
  {
    name: "strealm::components::strealm::strealm_structs::Flow",
    type: "struct",
    members: [
      {
        name: "rate",
        type: "core::integer::u256",
      },
      {
        name: "end_at",
        type: "core::integer::u64",
      },
    ],
  },
  {
    name: "strealm::components::strealm::IStRealm",
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
        name: "get_reward_payer",
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
        name: "get_stream",
        type: "function",
        inputs: [
          {
            name: "owner",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "strealm::components::strealm::strealm_structs::Stream",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_flow",
        type: "function",
        inputs: [
          {
            name: "flow_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "strealm::components::strealm::strealm_structs::Flow",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_latest_flow_id",
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
        name: "get_reward_balance",
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
      {
        name: "update_flow_rate",
        type: "function",
        inputs: [
          {
            name: "new_rate",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "update_reward_payer",
        type: "function",
        inputs: [
          {
            name: "new_payer_address",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    name: "AccessControlImpl",
    type: "impl",
    interface_name:
      "openzeppelin::access::accesscontrol::interface::IAccessControl",
  },
  {
    name: "openzeppelin::access::accesscontrol::interface::IAccessControl",
    type: "interface",
    items: [
      {
        name: "has_role",
        type: "function",
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
        name: "get_role_admin",
        type: "function",
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
        name: "grant_role",
        type: "function",
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
        name: "revoke_role",
        type: "function",
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
        name: "renounce_role",
        type: "function",
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
    ],
  },
  {
    name: "constructor",
    type: "constructor",
    inputs: [
      {
        name: "default_admin",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "minter",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "upgrader",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "flow_rate",
        type: "core::integer::u256",
      },
      {
        name: "reward_token",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "reward_payer",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "metadata_addr",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::DelegateChanged",
    type: "event",
    members: [
      {
        kind: "key",
        name: "delegator",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "from_delegate",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "to_delegate",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::DelegateVotesChanged",
    type: "event",
    members: [
      {
        kind: "key",
        name: "delegate",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "previous_votes",
        type: "core::integer::u256",
      },
      {
        kind: "data",
        name: "new_votes",
        type: "core::integer::u256",
      },
    ],
  },
  {
    kind: "enum",
    name: "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "DelegateChanged",
        type: "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::DelegateChanged",
      },
      {
        kind: "nested",
        name: "DelegateVotesChanged",
        type: "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::DelegateVotesChanged",
      },
    ],
  },
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
    kind: "struct",
    name: "openzeppelin::token::erc721::erc721::ERC721Component::Approval",
    type: "event",
    members: [
      {
        kind: "key",
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "approved",
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
    kind: "struct",
    name: "openzeppelin::token::erc721::erc721::ERC721Component::ApprovalForAll",
    type: "event",
    members: [
      {
        kind: "key",
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "operator",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "approved",
        type: "core::bool",
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
      {
        kind: "nested",
        name: "Approval",
        type: "openzeppelin::token::erc721::erc721::ERC721Component::Approval",
      },
      {
        kind: "nested",
        name: "ApprovalForAll",
        type: "openzeppelin::token::erc721::erc721::ERC721Component::ApprovalForAll",
      },
    ],
  },
  {
    kind: "enum",
    name: "openzeppelin::introspection::src5::SRC5Component::Event",
    type: "event",
    variants: [],
  },
  {
    kind: "struct",
    name: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
    type: "event",
    members: [
      {
        kind: "data",
        name: "role",
        type: "core::felt252",
      },
      {
        kind: "data",
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
    type: "event",
    members: [
      {
        kind: "data",
        name: "role",
        type: "core::felt252",
      },
      {
        kind: "data",
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
    type: "event",
    members: [
      {
        kind: "data",
        name: "role",
        type: "core::felt252",
      },
      {
        kind: "data",
        name: "previous_admin_role",
        type: "core::felt252",
      },
      {
        kind: "data",
        name: "new_admin_role",
        type: "core::felt252",
      },
    ],
  },
  {
    kind: "enum",
    name: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "RoleGranted",
        type: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
      },
      {
        kind: "nested",
        name: "RoleRevoked",
        type: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
      },
      {
        kind: "nested",
        name: "RoleAdminChanged",
        type: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
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
    kind: "enum",
    name: "openzeppelin::utils::cryptography::nonces::NoncesComponent::Event",
    type: "event",
    variants: [],
  },
  {
    kind: "struct",
    name: "strealm::components::strealm::StRealmComponent::FlowRateChanged",
    type: "event",
    members: [
      {
        kind: "key",
        name: "id",
        type: "core::integer::u64",
      },
      {
        kind: "data",
        name: "rate",
        type: "core::integer::u256",
      },
    ],
  },
  {
    kind: "struct",
    name: "strealm::components::strealm::StRealmComponent::RewardTokenUpdated",
    type: "event",
    members: [
      {
        kind: "key",
        name: "old_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "new_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "strealm::components::strealm::StRealmComponent::RewardPayerUpdated",
    type: "event",
    members: [
      {
        kind: "key",
        name: "old_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "new_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    kind: "struct",
    name: "strealm::components::strealm::StRealmComponent::RewardClaimed",
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
    ],
  },
  {
    kind: "enum",
    name: "strealm::components::strealm::StRealmComponent::Event",
    type: "event",
    variants: [
      {
        kind: "nested",
        name: "FlowRateChanged",
        type: "strealm::components::strealm::StRealmComponent::FlowRateChanged",
      },
      {
        kind: "nested",
        name: "RewardTokenUpdated",
        type: "strealm::components::strealm::StRealmComponent::RewardTokenUpdated",
      },
      {
        kind: "nested",
        name: "RewardPayerUpdated",
        type: "strealm::components::strealm::StRealmComponent::RewardPayerUpdated",
      },
      {
        kind: "nested",
        name: "RewardClaimed",
        type: "strealm::components::strealm::StRealmComponent::RewardClaimed",
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
        name: "ERC721VotesEvent",
        type: "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::Event",
      },
      {
        kind: "flat",
        name: "ERC721Event",
        type: "openzeppelin::token::erc721::erc721::ERC721Component::Event",
      },
      {
        kind: "flat",
        name: "SRC5Event",
        type: "openzeppelin::introspection::src5::SRC5Component::Event",
      },
      {
        kind: "flat",
        name: "AccessControlEvent",
        type: "openzeppelin::access::accesscontrol::accesscontrol::AccessControlComponent::Event",
      },
      {
        kind: "flat",
        name: "UpgradeableEvent",
        type: "openzeppelin::upgrades::upgradeable::UpgradeableComponent::Event",
      },
      {
        kind: "flat",
        name: "NoncesEvent",
        type: "openzeppelin::utils::cryptography::nonces::NoncesComponent::Event",
      },
      {
        kind: "flat",
        name: "StRealmEvent",
        type: "strealm::components::strealm::StRealmComponent::Event",
      },
    ],
  },
] as const satisfies Abi;
