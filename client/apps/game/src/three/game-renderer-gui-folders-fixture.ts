import { destroyTrackedGuiFolders } from "./utils/gui-folder-lifecycle";

interface GameRendererGuiFoldersFixture {
  activeGuiFolders: number;
  destroy(): void;
}

export function createGameRendererGuiFoldersFixture(): GameRendererGuiFoldersFixture {
  let activeGuiFolders = 6;
  const guiFolders = Array.from({ length: activeGuiFolders }, () => ({
    destroy: () => {
      activeGuiFolders -= 1;
    },
  }));

  return {
    get activeGuiFolders() {
      return activeGuiFolders;
    },
    destroy() {
      destroyTrackedGuiFolders(guiFolders);
    },
  };
}
