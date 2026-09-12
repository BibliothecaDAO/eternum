import { questForExplorerQuery, readQuestEntity } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context";

export const useGetQuestForExplorer = (explorerId: number, questTileId: number) => {
  const {
    setup: { components },
  } = useDojo();

  const questEntities = useEntityQuery(questForExplorerQuery(components, explorerId, questTileId));

  return readQuestEntity(questEntities);
};
