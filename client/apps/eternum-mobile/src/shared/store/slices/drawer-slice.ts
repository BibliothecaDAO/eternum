import { Direction, ID } from "@bibliothecadao/types";

export interface DrawerSlice {
  // Chest drawer state
  isChestDrawerOpen: boolean;
  chestDrawerData: {
    explorerEntityId: ID | null;
    chestHex: { x: number; y: number } | null;
  };

  // Army creation drawer state
  isArmyCreationDrawerOpen: boolean;
  armyCreationDrawerData: {
    structureId: ID | null;
    direction: Direction | null;
    isExplorer: boolean;
  };

  // Chest drawer actions
  toggleChestDrawer: () => void;
  setChestDrawer: (isOpen: boolean) => void;
  openChestDrawer: (explorerEntityId: ID, chestHex: { x: number; y: number }) => void;
  closeChestDrawer: () => void;

  // Army creation drawer actions
  setArmyCreationDrawer: (data: {
    isOpen: boolean;
    structureId?: ID;
    direction?: Direction;
    isExplorer?: boolean;
  }) => void;
  closeArmyCreationDrawer: () => void;
}

export const createDrawerSlice = (set: any) => ({
  // Initial chest drawer state
  isChestDrawerOpen: false,
  chestDrawerData: {
    explorerEntityId: null,
    chestHex: null,
  },

  // Initial army creation drawer state
  isArmyCreationDrawerOpen: false,
  armyCreationDrawerData: {
    structureId: null,
    direction: null,
    isExplorer: true,
  },

  // Chest drawer actions
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

  // Army creation drawer actions
  setArmyCreationDrawer: (data: {
    isOpen: boolean;
    structureId?: ID;
    direction?: Direction;
    isExplorer?: boolean;
  }) => {
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
