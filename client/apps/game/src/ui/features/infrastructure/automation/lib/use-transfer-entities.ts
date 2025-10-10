import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { sqlApi } from "@/services/api";
import { normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { getIsBlitz, getGuildFromPlayerAddress, getStructureTypeName } from "@bibliothecadao/eternum";
import { useGuildMembers } from "@bibliothecadao/react";
import type { ClientComponents, Structure } from "@bibliothecadao/types";
import { StructureType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";

import { useDebounce } from "@/shared/lib/hooks";
import type { EntityIdFormat, EntityTypeOption, TransferEntityOption } from "./transfer-types";
import { mapStructureToEntity, withEntityDisplayData } from "./transfer-utils";

interface UseTransferEntitiesOptions {
  accountAddress: string;
  components: ClientComponents | null | undefined;
  playerStructures: Structure[];
  guildOnly: boolean;
}

interface EntityGroup {
  name: string;
  entities: TransferEntityOption[];
  totalCount: number;
}

export const useTransferEntities = ({
  accountAddress,
  components,
  playerStructures,
  guildOnly,
}: UseTransferEntitiesOptions) => {
  const [sourceEntityType, setSourceEntityType] = useState<string>("");
  const [destinationEntityType, setDestinationEntityType] = useState<string>("");
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");
  const [destinationSearchTerm, setDestinationSearchTerm] = useState("");
  const [, startTransition] = useTransition();

  const handleSourceSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSourceSearchTerm(value);
    });
  }, []);

  const handleDestinationSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setDestinationSearchTerm(value);
    });
  }, []);

  const debouncedSourceSearchTerm = useDebounce(sourceSearchTerm, 300);
  const debouncedDestinationSearchTerm = useDebounce(destinationSearchTerm, 300);

  const { data: otherStructures = [] } = useQuery<EntityIdFormat[]>({
    queryKey: ["otherStructures", accountAddress],
    queryFn: () => sqlApi.fetchOtherStructures(accountAddress),
    staleTime: 5 * 60 * 1000,
    gcTime: 1 * 60 * 1000,
  });

  const guild = useMemo(() => {
    if (!accountAddress || !components) {
      return null;
    }
    try {
      return getGuildFromPlayerAddress(BigInt(accountAddress), components);
    } catch (error) {
      console.error("Failed to resolve guild members", error);
      return null;
    }
  }, [accountAddress, components]);

  const guildMembers = useGuildMembers(guild?.entityId || BigInt(0));

  const playersInPlayersGuildAddress = useMemo(() => guildMembers.map((member) => member.address), [guildMembers]);

  const categorizedPlayerStructures = useMemo(() => {
    const categories = {
      [StructureType.Realm]: [] as EntityIdFormat[],
      [StructureType.Village]: [] as EntityIdFormat[],
      [StructureType.Hyperstructure]: [] as EntityIdFormat[],
      [StructureType.FragmentMine]: [] as EntityIdFormat[],
      [StructureType.Bank]: [] as EntityIdFormat[],
    };

    playerStructures.forEach((structure) => {
      const category = structure.structure.base.category;
      if (category in categories) {
        (categories[category as StructureType] as EntityIdFormat[]).push(mapStructureToEntity(structure));
      }
    });

    return categories;
  }, [playerStructures]);

  const categorizedOtherStructures = useMemo(() => {
    const categories = {
      [StructureType.Realm]: [] as EntityIdFormat[],
      [StructureType.Village]: [] as EntityIdFormat[],
      [StructureType.Hyperstructure]: [] as EntityIdFormat[],
      [StructureType.FragmentMine]: [] as EntityIdFormat[],
      [StructureType.Bank]: [] as EntityIdFormat[],
    };

    otherStructures.forEach((structure) => {
      const category = structure.category;
      if (category in categories) {
        (categories[category as StructureType] as EntityIdFormat[]).push(structure);
      }
    });

    return categories;
  }, [otherStructures]);

  const isBlitz = getIsBlitz();

  const makeEntityGroups = useCallback(
    (source: Record<StructureType, EntityIdFormat[]>, labelPrefix: "Your" | "Other", filterByGuild = false) => {
      const groups: EntityGroup[] = [];

      Object.entries(source).forEach(([categoryKey, entities]) => {
        const category = Number(categoryKey) as StructureType;
        const categoryName = getStructureTypeName(category, isBlitz);
        const name = `${labelPrefix} ${categoryName}s`;

        const filtered = filterByGuild
          ? entities.filter((entity) => {
              const isGuildMember = playersInPlayersGuildAddress.includes(BigInt(entity.owner));
              return guildOnly ? isGuildMember : !isGuildMember;
            })
          : entities;

        const withDisplay = filtered.map((entity) => withEntityDisplayData(entity, components, isBlitz));

        groups.push({
          name,
          entities: withDisplay,
          totalCount: filtered.length,
        });
      });

      return groups;
    },
    [components, guildOnly, isBlitz, playersInPlayersGuildAddress],
  );

  const sourceEntitiesListWithAccountNames = useMemo(
    () => makeEntityGroups(categorizedPlayerStructures, "Your", false),
    [categorizedPlayerStructures, makeEntityGroups],
  );

  const entitiesListWithAccountNames = useMemo(() => {
    const yourGroups = makeEntityGroups(categorizedPlayerStructures, "Your", false);
    const otherGroups = makeEntityGroups(categorizedOtherStructures, "Other", true);
    return [...yourGroups, ...otherGroups];
  }, [categorizedOtherStructures, categorizedPlayerStructures, makeEntityGroups]);

  useEffect(() => {
    if (sourceEntityType) {
      return;
    }

    const preferredSource = sourceEntitiesListWithAccountNames.find(
      ({ name, entities }) => name === "Your Realms" && entities.length > 0,
    );
    const fallbackSource = sourceEntitiesListWithAccountNames.find(({ entities }) => entities.length > 0);
    const targetValue = preferredSource ?? fallbackSource;

    if (targetValue) {
      setSourceEntityType(targetValue.name);
    }
  }, [sourceEntityType, sourceEntitiesListWithAccountNames]);

  useEffect(() => {
    if (destinationEntityType) {
      return;
    }

    const preferredDestination = entitiesListWithAccountNames.find(
      ({ name, entities }) => name === "Your Realms" && entities.length > 0,
    );
    const fallbackDestination = entitiesListWithAccountNames.find(({ entities }) => entities.length > 0);
    const targetValue = preferredDestination ?? fallbackDestination;

    if (targetValue) {
      setDestinationEntityType(targetValue.name);
    }
  }, [destinationEntityType, entitiesListWithAccountNames]);

  const entityTypeOptions: EntityTypeOption[] = useMemo(
    () =>
      entitiesListWithAccountNames
        .filter(({ entities }) => entities.length > 0)
        .map(({ name, totalCount }) => ({
          value: name,
          label: `${name} (${totalCount})`,
        })),
    [entitiesListWithAccountNames],
  );

  const sourceEntityTypeOptions: EntityTypeOption[] = useMemo(
    () =>
      sourceEntitiesListWithAccountNames
        .filter(({ entities }) => entities.length > 0)
        .map(({ name, totalCount }) => ({
          value: name,
          label: `${name} (${totalCount})`,
        })),
    [sourceEntitiesListWithAccountNames],
  );

  const filteredSourceEntities = useMemo(() => {
    if (!sourceEntityType) return [];

    const categoryEntities =
      sourceEntitiesListWithAccountNames.find(({ name }) => name === sourceEntityType)?.entities || [];

    if (!debouncedSourceSearchTerm || debouncedSourceSearchTerm.length < 2) {
      return categoryEntities.slice(0, 50);
    }

    const normalizedSearch = normalizeDiacriticalMarks(debouncedSourceSearchTerm.toLowerCase());

    return categoryEntities
      .filter((entity) => {
        const normalizedName = normalizeDiacriticalMarks(entity.name.toLowerCase());
        const normalizedAccount = entity.accountName ? normalizeDiacriticalMarks(entity.accountName.toLowerCase()) : "";

        return normalizedName.includes(normalizedSearch) || normalizedAccount.includes(normalizedSearch);
      })
      .slice(0, 50);
  }, [debouncedSourceSearchTerm, sourceEntitiesListWithAccountNames, sourceEntityType]);

  const filteredDestinationEntities = useMemo(() => {
    if (!destinationEntityType) return [];

    const categoryEntities =
      entitiesListWithAccountNames.find(({ name }) => name === destinationEntityType)?.entities || [];

    if (!debouncedDestinationSearchTerm || debouncedDestinationSearchTerm.length < 2) {
      return categoryEntities.slice(0, 50);
    }

    const normalizedSearch = normalizeDiacriticalMarks(debouncedDestinationSearchTerm.toLowerCase());

    return categoryEntities
      .filter((entity) => {
        const normalizedName = normalizeDiacriticalMarks(entity.name.toLowerCase());
        const normalizedAccount = entity.accountName ? normalizeDiacriticalMarks(entity.accountName.toLowerCase()) : "";

        return normalizedName.includes(normalizedSearch) || normalizedAccount.includes(normalizedSearch);
      })
      .slice(0, 50);
  }, [debouncedDestinationSearchTerm, destinationEntityType, entitiesListWithAccountNames]);

  return {
    sourceEntityType,
    destinationEntityType,
    setSourceEntityType,
    setDestinationEntityType,
    sourceSearchTerm,
    destinationSearchTerm,
    setSourceSearchTerm,
    setDestinationSearchTerm,
    handleSourceSearchChange,
    handleDestinationSearchChange,
    debouncedSourceSearchTerm,
    debouncedDestinationSearchTerm,
    entityTypeOptions,
    sourceEntityTypeOptions,
    filteredSourceEntities,
    filteredDestinationEntities,
    sourceEntitiesListWithAccountNames,
    entitiesListWithAccountNames,
  };
};
