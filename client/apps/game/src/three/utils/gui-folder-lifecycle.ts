interface DestroyableGuiFolder {
  destroy(): void;
}

export function trackGuiFolder<T extends DestroyableGuiFolder>(folders: T[], folder: T): T {
  folders.push(folder);
  return folder;
}

export function destroyTrackedGuiFolders(folders: Array<DestroyableGuiFolder | null | undefined>): void {
  const trackedFolders = folders.splice(0, folders.length);
  trackedFolders.forEach((folder) => folder?.destroy());
}
