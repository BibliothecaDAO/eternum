import type { ArmySpatialProjectionChange } from "@bibliothecadao/eternum/game-sync";
import type { ID } from "@bibliothecadao/types";

interface FollowArmyLayerInput {
  changes: readonly ArmySpatialProjectionChange[];
  getSelectedId(): ID | null | undefined;
  getLayer(): boolean;
  isSceneActive(): boolean;
  setLayer(alt: boolean): void;
  finishMovement(entityId: ID): void;
  refresh(): Promise<unknown>;
  select(entityId: ID): void;
}

/** Follow projection state, including a rollback, without overriding a later manual selection. */
export async function followArmyLayerChange(input: FollowArmyLayerInput): Promise<void> {
  if (!input.isSceneActive()) return;
  const selectedId = input.getSelectedId();
  const crossing = input.changes.find(
    ({ entityId, previous, current }) =>
      entityId === selectedId && previous && current && previous.hexCoords.alt !== current.hexCoords.alt,
  );
  if (!crossing?.current) return;
  const { entityId, hexCoords } = crossing.current;
  input.finishMovement(entityId);
  input.setLayer(hexCoords.alt);
  await input.refresh();
  if (!input.isSceneActive() || input.getLayer() !== hexCoords.alt || input.getSelectedId() !== entityId) return;
  input.select(entityId);
}
