import { ActorType, Direction, ID } from "@bibliothecadao/types";

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

  // Transfer drawer state
  isTransferDrawerOpen: boolean;
  transferDrawerData: {
    selected: {
      type: ActorType;
      id: ID;
      hex: { x: number; y: number };
    } | null;
    target: {
      type: ActorType;
      id: ID;
      hex: { x: number; y: number };
    } | null;
    allowBothDirections: boolean;
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

  // Transfer drawer actions
  openTransferDrawer: (
    selected: { type: ActorType; id: ID; hex: { x: number; y: number } },
    target: { type: ActorType; id: ID; hex: { x: number; y: number } },
    allowBothDirections?: boolean
  ) => void;
  closeTransferDrawer: () => void;
  setTransferDrawer: (isOpen: boolean) => void;
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

  // Initial transfer drawer state
  isTransferDrawerOpen: false,
  transferDrawerData: {
    selected: null,
    target: null,
    allowBothDirections: false,
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

  // Transfer drawer actions
  openTransferDrawer: (
    selected: { type: ActorType; id: ID; hex: { x: number; y: number } },
    target: { type: ActorType; id: ID; hex: { x: number; y: number } },
    allowBothDirections: boolean = false
  ) => {
    set({
      isTransferDrawerOpen: true,
      transferDrawerData: {
        selected,
        target,
        allowBothDirections,
      },
    });
  },

  closeTransferDrawer: () => {
    set({
      isTransferDrawerOpen: false,
      transferDrawerData: {
        selected: null,
        target: null,
        allowBothDirections: false,
      },
    });
  },

  setTransferDrawer: (isOpen: boolean) => {
    set({
      isTransferDrawerOpen: isOpen,
    });
  },
});
