import { TransferBetweenEntities } from "@/ui/components/trading/transfer-between-entities";
import {
  ContractAddress,
  PlayerStructure,
  RealmWithPosition,
  StructureType,
  getEntityName,
  getRealmNameById,
} from "@bibliothecadao/eternum";
import { useDojo, useGuilds, usePlayerRealms, usePlayerStructures } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, NotValue, getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";

export const TransferView = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const { Structure, Position, Owner, Realm } = components;

  const playerRealms = usePlayerRealms();
  const playerStructures = usePlayerStructures();

  const [guildOnly, setGuildOnly] = useState(false);

  const { getPlayersInPlayersGuild } = useGuilds();

  const playersInPlayersGuildAddress = useMemo(() => {
    return getPlayersInPlayersGuild(BigInt(account.address)).map((a) => BigInt(a.address));
  }, [account.address]);

  const otherStructuresQuery = useEntityQuery([
    Has(Structure),
    Has(Position),
    Has(Owner),
    NotValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const otherStructures = useMemo(() => {
    return otherStructuresQuery
      .map((id) => {
        const structure = getComponentValue(Structure, id);
        if (!structure || structure.category === StructureType[StructureType.Realm]) return;

        const position = getComponentValue(Position, id);

        const structureName = getEntityName(structure.entity_id, components);

        const name = structureName ? `${structure?.category} ${structureName}` : structure.category || "";
        return { ...structure, position: position!, name, owner: getComponentValue(Owner, id) };
      })
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [otherStructuresQuery]);

  const otherRealmsQuery = useEntityQuery([Has(Realm), NotValue(Owner, { address: ContractAddress(account.address) })]);

  const otherRealms = useMemo(() => {
    return otherRealmsQuery.map((id) => {
      const realm = getComponentValue(Realm, id);
      return {
        ...realm,
        position: getComponentValue(Position, id),
        name: getRealmNameById(realm!.realm_id),
        owner: getComponentValue(Owner, id),
      } as RealmWithPosition;
    });
  }, [otherRealmsQuery]);

  return (
    <TransferBetweenEntities
      filterBy={setGuildOnly}
      filtered={guildOnly}
      entitiesList={[
        { entities: playerRealms, name: "Your Realms" },
        {
          entities: playerStructures.filter((structure) => structure.category === "Hyperstructure"),
          name: "Your Hyperstructures",
        },
        {
          entities: playerStructures.filter((structure) => structure.category === "FragmentMine"),
          name: "Your Fragment Mines",
        },
        {
          entities: playerStructures.filter((structure) => structure.category === "Bank"),
          name: "Your Banks",
        },
        {
          entities: otherRealms.filter((a) =>
            guildOnly
              ? playersInPlayersGuildAddress.includes(a.owner.address)
              : !playersInPlayersGuildAddress.includes(a.owner.address),
          ),
          name: "Other Realms",
        },
        {
          entities: otherStructures.filter((a) =>
            guildOnly
              ? playersInPlayersGuildAddress.includes(a.owner.address)
              : !playersInPlayersGuildAddress.includes(a.owner.address),
          ),
          name: "Other Structures",
        },
      ]}
    />
  );
};
