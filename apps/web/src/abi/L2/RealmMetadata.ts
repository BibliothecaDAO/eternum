import type { Abi } from "starknet";

export const RealmMetadataABI = [
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
] as const satisfies Abi;
