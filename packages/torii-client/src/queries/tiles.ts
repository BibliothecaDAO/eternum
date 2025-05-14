import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { AndComposeClause, MemberClause, OrComposeClause } from "@dojoengine/sdk";
import { Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getTileFromToriiEntity } from "../parser/tile";

export const getTilesFromToriiClient = async (
  toriiClient: ToriiClient,
  coordsList: { col: number; row: number }[],
): Promise<ComponentValue<ClientComponents["Tile"]["schema"]>[]> => {
  const tileQuery: Query = {
    pagination: {
      limit: 6 * coordsList.length,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    models: ["s1_eternum-Tile"],
    no_hashed_keys: false,
    historical: false,
    clause: OrComposeClause(
      coordsList.map((hex) =>
        AndComposeClause([
          MemberClause("s1_eternum-Tile", "col", "Eq", hex.col),
          MemberClause("s1_eternum-Tile", "row", "Eq", hex.row),
        ]),
      ),
    ).build(),
  };

  const response = await toriiClient.getEntities(tileQuery);

  if (!response?.items) {
    return [];
  }

  return response.items
    .map((item) => {
      if (!item?.models || !item.models["s1_eternum-Tile"]) {
        return null;
      }
      return getTileFromToriiEntity(item.models["s1_eternum-Tile"]);
    })
    .filter((tile): tile is NonNullable<typeof tile> => tile !== null);
};
