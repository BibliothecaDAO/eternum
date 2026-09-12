interface Destroyable {
  destroy(): void;
}

interface WorldmapOwnedManagers {
  armyManager?: Destroyable | null;
  structureManager?: Destroyable | null;
  reservedHyperstructureManager?: Destroyable | null;
  spireManager?: Destroyable | null;
  chestManager?: Destroyable | null;
  fxManager?: Destroyable | null;
  resourceFXManager?: Destroyable | null;
}

export function destroyWorldmapOwnedManagers(managers: WorldmapOwnedManagers): void {
  managers.armyManager?.destroy();
  managers.structureManager?.destroy();
  managers.reservedHyperstructureManager?.destroy();
  managers.spireManager?.destroy();
  managers.chestManager?.destroy();
  managers.fxManager?.destroy();
  managers.resourceFXManager?.destroy();
}
