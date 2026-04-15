import type { GuiFolderLike } from "./gui-manager";

export interface DestroyableGuiFolder {
  destroy(): void;
}

export type TrackableGuiFolder = DestroyableGuiFolder & Pick<GuiFolderLike, "add" | "addFolder" | "close" | "open">;

export function trackGuiFolder<T extends TrackableGuiFolder>(folders: T[], folder: T): T {
  folders.push(folder);
  return folder;
}

export function destroyTrackedGuiFolders(folders: Array<DestroyableGuiFolder | null | undefined>): void {
  const trackedFolders = folders.splice(0, folders.length);
  trackedFolders.forEach((folder) => folder?.destroy());
}
