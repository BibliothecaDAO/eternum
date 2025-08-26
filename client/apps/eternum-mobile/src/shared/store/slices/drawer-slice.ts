import { ID } from "@bibliothecadao/types";

export interface DrawerSlice {
  isChestDrawerOpen: boolean;
  chestDrawerData: {
    explorerEntityId: ID | null;
    chestHex: { x: number; y: number } | null;
  };
  toggleChestDrawer: () => void;
  setChestDrawer: (isOpen: boolean) => void;
  openChestDrawer: (explorerEntityId: ID, chestHex: { x: number; y: number }) => void;
  closeChestDrawer: () => void;
}

export const createDrawerSlice = (set: any) => ({
  isChestDrawerOpen: false,
  chestDrawerData: {
    explorerEntityId: null,
    chestHex: null,
  },

  toggleChestDrawer: () => {
    set((state: DrawerSlice) => ({
      isChestDrawerOpen: !state.isChestDrawerOpen,
    }));
  },

  setChestDrawer: (isOpen: boolean) => {
    set({ isChestDrawerOpen: isOpen });
  },

  openChestDrawer: (explorerEntityId: ID, chestHex: { x: number; y: number }) => {
    set({
      isChestDrawerOpen: true,
      chestDrawerData: {
        explorerEntityId,
        chestHex,
      },
    });
  },

  closeChestDrawer: () => {
    set({
      isChestDrawerOpen: false,
      chestDrawerData: {
        explorerEntityId: null,
        chestHex: null,
      },
    });
  },
});
