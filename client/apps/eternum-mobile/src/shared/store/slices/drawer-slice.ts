import { Direction, ID } from "@bibliothecadao/types";

export interface DrawerSlice {
  isChestDrawerOpen: boolean;
  chestDrawerData: {
    explorerEntityId: ID | null;
    chestHex: { x: number; y: number } | null;
  };
  isArmyCreationDrawerOpen: boolean;
  armyCreationDrawerData: {
    structureId: ID | null;
    direction: Direction | null;
    isExplorer: boolean;
  };
  toggleChestDrawer: () => void;
  setChestDrawer: (isOpen: boolean) => void;
  openChestDrawer: (explorerEntityId: ID, chestHex: { x: number; y: number }) => void;
  closeChestDrawer: () => void;
  setArmyCreationDrawer: (data: { isOpen: boolean; structureId?: ID; direction?: Direction; isExplorer?: boolean }) => void;
  closeArmyCreationDrawer: () => void;
}

export const createDrawerSlice = (set: any) => ({
  isChestDrawerOpen: false,
  chestDrawerData: {
    explorerEntityId: null,
    chestHex: null,
  },
  isArmyCreationDrawerOpen: false,
  armyCreationDrawerData: {
    structureId: null,
    direction: null,
    isExplorer: true,
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

  setArmyCreationDrawer: (data: { isOpen: boolean; structureId?: ID; direction?: Direction; isExplorer?: boolean }) => {
    set({
      isArmyCreationDrawerOpen: data.isOpen,
      armyCreationDrawerData: {
        structureId: data.structureId || null,
        direction: data.direction || null,
        isExplorer: data.isExplorer !== undefined ? data.isExplorer : true,
      },
    });
  },

  closeArmyCreationDrawer: () => {
    set({
      isArmyCreationDrawerOpen: false,
      armyCreationDrawerData: {
        structureId: null,
        direction: null,
        isExplorer: true,
      },
    });
  },
});
