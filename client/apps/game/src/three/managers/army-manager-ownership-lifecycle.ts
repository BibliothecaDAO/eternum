import { destroyTrackedGuiFolders, type DestroyableGuiFolder } from "../utils/gui-folder-lifecycle";

interface DisposablePathRenderer {
  dispose(): void;
}

interface ArmyManagerOwnedResources {
  pathRenderer?: DisposablePathRenderer | null;
  guiFolders: DestroyableGuiFolder[];
}

export function destroyArmyManagerOwnedResources(resources: ArmyManagerOwnedResources): void {
  resources.pathRenderer?.dispose();
  destroyTrackedGuiFolders(resources.guiFolders);
}
