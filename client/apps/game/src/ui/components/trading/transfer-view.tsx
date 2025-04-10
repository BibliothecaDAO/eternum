import { TransferBetweenEntities } from "@/ui/components/trading/transfer-between-entities";
import {
  getEntityName,
  getGuildMembersFromPlayerAddress,
  getRealmNameById,
} from "@bibliothecadao/eternum";
import {
  ContractAddress,
  PlayerStructure,
  RealmWithPosition,
  StructureType,
} from "@bibliothecadao/types";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, NotValue, getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";

export const TransferView = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const { Structure } = components;

  const playerStructures = usePlayerStructures();

  const [guildOnly, setGuildOnly] = useState(false);

  const playersInPlayersGuildAddress = useMemo(() => {
    return (
      getGuildMembersFromPlayerAddress(ContractAddress(account.address), components)?.map((a) => BigInt(a.address)) ||
      []
    );
  }, [account.address]);

  const otherStructuresQuery = useEntityQuery([
    Has(Structure),
    NotValue(Structure, { owner: ContractAddress(account.address) }),
  ]);

  const otherStructures = useMemo(() => {
    return otherStructuresQuery
      .map((id) => {
        const structure = getComponentValue(Structure, id);
        if (!structure || structure.base.category === StructureType.Realm) return;

        const structureName = getEntityName(structure.entity_id, components);

        const name = structureName ? `${structure.base.category} ${structureName}` : structure.base.category || "";
        return {
          structure,
          entityId: structure.entity_id,
          position: { x: structure.base.coord_x, y: structure.base.coord_y },
          name,
          owner: structure.owner,
        };
      })
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => Number(a.structure.base.category) - Number(b.structure.base.category));
  }, [otherStructuresQuery]);

  const otherRealmsQuery = useEntityQuery([
    Has(Structure),
    HasValue(Structure, { category: StructureType.Realm }),
    NotValue(Structure, { owner: ContractAddress(account.address) }),
  ]);

  const otherRealms = useMemo(() => {
    return otherRealmsQuery.map((id) => {
      const structure = getComponentValue(Structure, id);
      return {
        ...structure?.metadata,
        entityId: structure?.entity_id,
        position: { x: structure?.base.coord_x, y: structure?.base.coord_y },
        name: structure ? getRealmNameById(structure.metadata.realm_id) : "",
        owner: structure?.owner,
      } as RealmWithPosition;
    });
  }, [otherRealmsQuery]);

  return (
    <TransferBetweenEntities
      filterBy={setGuildOnly}
      filtered={guildOnly}
      entitiesList={[
        {
          entities: playerStructures.filter((structure) => structure.structure.base.category === StructureType.Realm),
          name: "Your Realms",
        },
        {
          entities: playerStructures.filter((structure) => structure.structure.base.category === StructureType.Village),
          name: "Your Villages",
        },
        {
          entities: playerStructures.filter(
            (structure) => structure.structure.base.category === StructureType.Hyperstructure,
          ),
          name: "Your Hyperstructures",
        },
        {
          entities: playerStructures.filter(
            (structure) => structure.structure.base.category === StructureType.FragmentMine,
          ),
          name: "Your Fragment Mines",
        },
        {
          entities: playerStructures.filter((structure) => structure.structure.base.category === StructureType.Bank),
          name: "Your Banks",
        },
        {
          entities: otherRealms.filter((a) =>
            guildOnly
              ? playersInPlayersGuildAddress.includes(a.owner)
              : !playersInPlayersGuildAddress.includes(a.owner),
          ),
          name: "Other Realms",
        },
        {
          entities: otherStructures.filter((a) =>
            guildOnly
              ? playersInPlayersGuildAddress.includes(a?.owner)
              : !playersInPlayersGuildAddress.includes(a?.owner),
          ),
          name: "Other Structures",
        },
      ]}
    />
  );
};
