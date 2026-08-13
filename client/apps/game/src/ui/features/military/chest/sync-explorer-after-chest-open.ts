import { gameModel } from "@/dojo/game-scope";
import { getEntitiesFromTorii } from "@/dojo/queries";
import type { ID } from "@bibliothecadao/types";

export type ExplorerChestSyncComponents = Parameters<typeof getEntitiesFromTorii>[1];

export async function syncExplorerAfterChestOpen({
  toriiClient,
  contractComponents,
  explorerEntityId,
}: {
  toriiClient: Parameters<typeof getEntitiesFromTorii>[0] | null | undefined;
  contractComponents: ExplorerChestSyncComponents | null | undefined;
  explorerEntityId: ID;
}) {
  if (!toriiClient || !contractComponents) {
    return;
  }

  try {
    await getEntitiesFromTorii(
      toriiClient,
      contractComponents,
      [explorerEntityId],
      [gameModel("ExplorerTroops"), gameModel("Resource")],
    );
  } catch (error) {
    console.error("[relic-chest] Failed to refresh explorer rewards", error);
  }
}
