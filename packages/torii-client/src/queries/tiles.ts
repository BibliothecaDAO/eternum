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
    limit: 6,
    offset: 0,
    entity_models: ["s1_eternum-Tile"],
    dont_include_hashed_keys: false,
    entity_updated_after: 0,
    order_by: [],
    clause: OrComposeClause(
      coordsList.map((hex) =>
        AndComposeClause([
          MemberClause("s1_eternum-Tile", "col", "Eq", hex.col),
          MemberClause("s1_eternum-Tile", "row", "Eq", hex.row),
        ]),
      ),
    ).build(),
  };

  const tiles = await toriiClient.getEntities(tileQuery, false);
  return Object.values(tiles).map((tile) => getTileFromToriiEntity(tile["s1_eternum-Tile"]));
};
