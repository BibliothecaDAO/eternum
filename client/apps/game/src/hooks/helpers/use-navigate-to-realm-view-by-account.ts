import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { getPlayerFirstRealm } from "@/utils/realms";
import { ContractAddress, getEntityIdFromKeys, SetupResult } from "@bibliothecadao/eternum";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { Clause, PatternMatching, Query } from "@dojoengine/torii-client";
import { useAccount } from "@starknet-react/core";
import { useEffect } from "react";
import { NULL_ACCOUNT } from "../context/dojo-context";
import { useNavigateToHexView } from "./use-navigate";
// navigates to the first realm the user sees when arriving on the page
export const useNavigateToRealmViewByAccount = (setup: SetupResult) => {
  const navigateToHexView = useNavigateToHexView();
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const spectatorRealmEntityId = useUIStore((state) => state.spectatorRealmEntityId);
  const { account } = useAccount();

  // navigate to random hex view if not connected or to player's first realm if connected
  useEffect(() => {
    const fetchRealm = async () => {
      if (!account) {
        // const randomRealmEntity = getRandomRealmEntity(components);
        const structureBase = spectatorRealmEntityId
          ? getComponentValue(setup.components.Structure, getEntityIdFromKeys([BigInt(spectatorRealmEntityId)]))?.base
          : undefined;
        if (spectatorRealmEntityId && structureBase) {
          setStructureEntityId(spectatorRealmEntityId);
          navigateToHexView(new Position({ x: structureBase.coord_x, y: structureBase.coord_y }));
        }
      } else {
        const playerRealm = getPlayerFirstRealm(
          setup.components,
          ContractAddress(account?.address || NULL_ACCOUNT.address),
        );
        const structureBase = playerRealm
          ? getComponentValue(setup.components.Structure, playerRealm)?.base
          : undefined;
        structureBase && navigateToHexView(new Position({ x: structureBase.coord_x, y: structureBase.coord_y }));
      }
    };
    fetchRealm();
  }, [account?.address]);
};

export const getFirstStructure = async (setup: SetupResult, ownedBy?: ContractAddress) => {
  const clause: Clause = !ownedBy
    ? {
        Keys: {
          keys: [undefined], // matches any key
          pattern_matching: "FixedLen" as PatternMatching,
          models: ["s1_eternum-Structure"], // specify the model you want to query
        },
      }
    : {
        Composite: {
          operator: "And",
          clauses: [
            {
              Keys: {
                keys: [undefined], // matches any key
                pattern_matching: "FixedLen" as PatternMatching,
                models: ["s1_eternum-Structure"], // specify the model you want to query
              },
            },
            {
              Member: {
                model: "s1_eternum-Structure",
                member: "owner",
                operator: "Eq",
                value: { Primitive: { U128: ownedBy.toString() } },
              },
            },
          ],
        },
      };

  const query: Query = {
    limit: 1,
    offset: 0,
    clause,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
  };

  const entities = await setup.network.toriiClient.getEntities(query);

  const realmEntity = Object.keys(entities)[0] as Entity;

  if (!realmEntity) {
    return;
  }

  const structure = entities[realmEntity]["s1_eternum-Structure"] as any;
  console.log("structure", structure);
  const entityId = structure.entity_id.value;
  const position = new Position({
    x: structure.base.value.coord_x.value,
    y: structure.base.value.coord_y.value,
  });

  return { entityId, position };
};
