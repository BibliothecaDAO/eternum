interface Disposable {
  dispose(): void;
}

interface HexagonSceneOwnedManagers {
  visibilityManager?: Disposable | null;
}

export function destroyHexagonSceneOwnedManagers(managers: HexagonSceneOwnedManagers): void {
  managers.visibilityManager?.dispose();
}
