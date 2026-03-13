interface Disposable {
  dispose(): void;
}

interface HexagonSceneOwnedManagers {
  frustumManager?: Disposable | null;
  visibilityManager?: Disposable | null;
}

export function destroyHexagonSceneOwnedManagers(managers: HexagonSceneOwnedManagers): void {
  managers.frustumManager?.dispose();
  managers.visibilityManager?.dispose();
}
