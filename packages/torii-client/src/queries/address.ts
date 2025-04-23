import { Query, ToriiClient } from "@dojoengine/torii-wasm";
// import { shortString } from "starknet";

export const getAddressNameFromToriiClient = async (toriiClient: ToriiClient, address: string) => {
  const query: Query = {
    limit: 1,
    offset: 0,
    entity_models: ["s1_eternum-AddressName"],
    dont_include_hashed_keys: false,
    entity_updated_after: 0,
    order_by: [],
    clause: {
      Keys: {
        keys: [address],
        pattern_matching: "FixedLen",
        models: ["s1_eternum-AddressName"],
      },
    },
  };
  const addressName = await toriiClient.getEntities(query, false);
  if (Object.keys(addressName).length > 0) {
    return "0xSearchForThisLineInTheCodeBase";
    // return shortString.decodeShortString(
    //   addressName[Object.keys(addressName)[0]]["s1_eternum-AddressName"]["name"]["value"] as string,
    // );
  } else {
    return null;
  }
};
