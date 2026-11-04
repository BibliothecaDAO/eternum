import type { ArmySpatialProjectionChange, WorldSpatialHex } from "@bibliothecadao/eternum/game-sync";
import type { ID } from "@bibliothecadao/types";

interface FollowArmyCrossingInput {
  changes: readonly ArmySpatialProjectionChange[];
  getSelectedId(): ID | null | undefined;
  getLayer(): boolean;
  isSceneActive(): boolean;
  /** Whether the army passed through a spire between the two places (isArmyCrossing). */
  isCrossing(from: WorldSpatialHex, to: WorldSpatialHex): boolean;
  setLayer(alt: boolean): void;
  /**
   * The view passes from the army's old tile to its arrival through the spire, left drawn there (viewThroughSpire):
   * true once it lands, false when a newer view or the map's exit cut it short.
   */
  lookThrough(from: WorldSpatialHex, to: WorldSpatialHex): Promise<boolean>;
  finishMovement(entityId: ID): void;
  select(entityId: ID): void;
}

/**
 * The view follows the selected army through a spire, onto the other layer or into the Ethereal layer a region away:
 * the layer switches and the view passes to its arrival, with no walk between (a dive through the spire). Follows
 * projection state, including a rollback, without overriding a later manual selection.
 */
export async function followArmyCrossing(input: FollowArmyCrossingInput): Promise<void> {
  if (!input.isSceneActive()) return;
  const selectedId = input.getSelectedId();
  const crossing = input.changes.find(
    ({ entityId, previous, current }) =>
      entityId === selectedId && previous && current && input.isCrossing(previous.hexCoords, current.hexCoords),
  );
  if (!crossing?.current || !crossing.previous) return;
  const { entityId, hexCoords } = crossing.current;
  input.finishMovement(entityId);
  input.setLayer(hexCoords.alt);
  const landed = await input.lookThrough(crossing.previous.hexCoords, hexCoords);
  if (!landed || !input.isSceneActive() || input.getLayer() !== hexCoords.alt || input.getSelectedId() !== entityId)
    return;
  input.select(entityId);
}
