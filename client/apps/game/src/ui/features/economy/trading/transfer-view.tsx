import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { TransferBetweenEntities } from "@/ui/features/economy/trading/transfer-between-entities";
import { getGuildMembersFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, ID, Structure, StructureType } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

export type EntityIdFormat = {
  entityId: ID;
  realmId: ID;
  category: StructureType;
  owner: ContractAddress;
};

export const TransferView = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const [otherStructures, setOtherStructures] = useState<{
    villages: EntityIdFormat[];
    realms: EntityIdFormat[];
    hyperstructures: EntityIdFormat[];
    fragmentMines: EntityIdFormat[];
    banks: EntityIdFormat[];
  }>({ villages: [], realms: [], hyperstructures: [], fragmentMines: [], banks: [] });

  useEffect(() => {
    const fetch = async () => {
      const result = await sqlApi.fetchOtherStructures(account.address);
      setOtherStructures({
        villages: result.filter((a) => a.category === StructureType.Village),
        realms: result.filter((a) => a.category === StructureType.Realm),
        hyperstructures: result.filter((a) => a.category === StructureType.Hyperstructure),
        fragmentMines: result.filter((a) => a.category === StructureType.FragmentMine),
        banks: result.filter((a) => a.category === StructureType.Bank),
      });
    };
    fetch();
  }, [account.address]);

  const playerStructures = useUIStore((state) => state.playerStructures);

  const [guildOnly, setGuildOnly] = useState(false);

  const playersInPlayersGuildAddress = useMemo(() => {
    return (
      getGuildMembersFromPlayerAddress(ContractAddress(account.address), components)?.map((a) => BigInt(a.address)) ||
      []
    );
  }, [account.address]);

  const mapToEntityIdFormat = (structure: Structure): EntityIdFormat => {
    return {
      entityId: structure.entityId,
      realmId: structure.structure.metadata.realm_id,
      category: structure.structure.base.category,
      owner: structure.structure.owner,
    };
  };

  // Create entity lists and filter out empty categories
  const entitiesList = useMemo(
    () => [
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Realm)
          .map(mapToEntityIdFormat),
        name: "Your Realms",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Village)
          .map(mapToEntityIdFormat),
        name: "Your Villages",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Hyperstructure)
          .map(mapToEntityIdFormat),
        name: "Your Hyperstructures",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.FragmentMine)
          .map(mapToEntityIdFormat),
        name: "Your Fragment Mines",
      },
      {
        entities: playerStructures
          .filter((structure) => structure.structure.base.category === StructureType.Bank)
          .map(mapToEntityIdFormat),
        name: "Your Banks",
      },
      {
        entities: otherStructures.realms.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Realms",
      },
      {
        entities: otherStructures.villages.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Villages",
      },
      {
        entities: otherStructures.hyperstructures.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Hyperstructures",
      },
      {
        entities: otherStructures.fragmentMines.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Fragment Mines",
      },
      {
        entities: otherStructures.banks.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Banks",
      },
    ],
    [playerStructures, otherStructures, guildOnly, playersInPlayersGuildAddress],
  );

  // Filter out categories with no entities
  const entitiesListFiltered = entitiesList.filter((item) => item.entities.length > 0);

  return <TransferBetweenEntities filterBy={setGuildOnly} filtered={guildOnly} entitiesList={entitiesListFiltered} />;
};
