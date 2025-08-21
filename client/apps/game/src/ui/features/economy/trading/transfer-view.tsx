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

  const [otherVillages, setOtherVillages] = useState<EntityIdFormat[]>([]);
  const [otherRealms, setOtherRealms] = useState<EntityIdFormat[]>([]);
  const [otherHyperstructures, setOtherHyperstructures] = useState<EntityIdFormat[]>([]);
  const [otherFragmentMines, setOtherFragmentMines] = useState<EntityIdFormat[]>([]);
  const [otherBanks, setOtherBanks] = useState<EntityIdFormat[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const otherStructures = await sqlApi.fetchOtherStructures(account.address);
      setOtherVillages(otherStructures.filter((a) => a.category === StructureType.Village));
      setOtherRealms(otherStructures.filter((a) => a.category === StructureType.Realm));
      setOtherHyperstructures(otherStructures.filter((a) => a.category === StructureType.Hyperstructure));
      setOtherFragmentMines(otherStructures.filter((a) => a.category === StructureType.FragmentMine));
      setOtherBanks(otherStructures.filter((a) => a.category === StructureType.Bank));
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
        entities: otherRealms.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Realms",
      },
      {
        entities: otherVillages.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Villages",
      },
      {
        entities: otherHyperstructures.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Hyperstructures",
      },
      {
        entities: otherFragmentMines.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Fragment Mines",
      },
      {
        entities: otherBanks.filter((a) =>
          guildOnly ? playersInPlayersGuildAddress.includes(a.owner) : !playersInPlayersGuildAddress.includes(a.owner),
        ),
        name: "Other Banks",
      },
    ],
    [
      playerStructures,
      otherRealms,
      otherVillages,
      otherHyperstructures,
      otherFragmentMines,
      otherBanks,
      guildOnly,
      playersInPlayersGuildAddress,
    ],
  );

  // Filter out categories with no entities
  const entitiesListFiltered = entitiesList.filter((item) => item.entities.length > 0);

  return <TransferBetweenEntities filterBy={setGuildOnly} filtered={guildOnly} entitiesList={entitiesListFiltered} />;
};
