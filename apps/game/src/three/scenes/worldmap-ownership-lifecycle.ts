interface Destroyable {
  destroy(): void;
}

interface WorldmapOwnedManagers {
  armyManager?: Destroyable | null;
  structureManager?: Destroyable | null;
  spireManager?: Destroyable | null;
  mapSiteManager?: Destroyable | null;
  deepArenaManager?: Destroyable | null;
  fxManager?: Destroyable | null;
  resourceFXManager?: Destroyable | null;
}

export function destroyWorldmapOwnedManagers(managers: WorldmapOwnedManagers): void {
  managers.armyManager?.destroy();
  managers.structureManager?.destroy();
  managers.spireManager?.destroy();
  managers.mapSiteManager?.destroy();
  managers.deepArenaManager?.destroy();
  managers.fxManager?.destroy();
  managers.resourceFXManager?.destroy();
}
