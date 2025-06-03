import { Query, ToriiClient } from "@dojoengine/torii-wasm";

export const getAddressNameFromToriiClient = async (toriiClient: ToriiClient, address: string) => {
  const query: Query = {
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    no_hashed_keys: false,
    models: ["s1_eternum-AddressName"],
    historical: false,
    clause: {
      Keys: {
        keys: [address],
        pattern_matching: "FixedLen",
        models: ["s1_eternum-AddressName"],
      },
    },
  };
  const addressName = await toriiClient.getEntities(query);
  if (addressName?.items?.length > 0) {
    return addressName.items[0].models["s1_eternum-AddressName"]["name"]["value"] as string;
  } else {
    return null;
  }
};
