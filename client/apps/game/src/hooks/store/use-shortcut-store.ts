import { create } from "zustand";

// Define modifier keys
export interface KeyModifiers {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac, Windows key on PC
}

// Define a keyboard shortcut
export interface KeyboardShortcut {
  id: string; // Unique identifier for the shortcut
  key: string;
  modifiers?: KeyModifiers;
  description: string;
  action: () => void;
  condition?: () => boolean; // Additional condition to check
}

interface ShortcutStore {
  shortcuts: Map<string, KeyboardShortcut>;
  enabled: boolean;
  
  // Actions
  addShortcut: (shortcut: KeyboardShortcut) => void;
  removeShortcut: (shortcutId: string) => void;
  removeShortcutsByPrefix: (prefix: string) => void;
  clearAllShortcuts: () => void;
  getShortcuts: () => KeyboardShortcut[];
  setEnabled: (enabled: boolean) => void;
  
  // Internal methods
  executeShortcut: (shortcutKey: string) => boolean;
}

export const useShortcutStore = create<ShortcutStore>((set, get) => ({
  shortcuts: new Map(),
  enabled: true,

  addShortcut: (shortcut: KeyboardShortcut) => {
    set((state) => {
      const newShortcuts = new Map(state.shortcuts);
      newShortcuts.set(shortcut.id, shortcut);
      return { shortcuts: newShortcuts };
    });
  },

  removeShortcut: (shortcutId: string) => {
    set((state) => {
      const newShortcuts = new Map(state.shortcuts);
      newShortcuts.delete(shortcutId);
      return { shortcuts: newShortcuts };
    });
  },

  removeShortcutsByPrefix: (prefix: string) => {
    set((state) => {
      const newShortcuts = new Map(state.shortcuts);
      for (const [id] of newShortcuts) {
        if (id.startsWith(prefix)) {
          newShortcuts.delete(id);
        }
      }
      return { shortcuts: newShortcuts };
    });
  },

  clearAllShortcuts: () => {
    set({ shortcuts: new Map() });
  },

  getShortcuts: () => {
    return Array.from(get().shortcuts.values());
  },

  setEnabled: (enabled: boolean) => {
    set({ enabled });
  },

  executeShortcut: (shortcutKey: string) => {
    const state = get();
    if (!state.enabled) return false;

    // Find shortcut by matching key combination
    for (const shortcut of state.shortcuts.values()) {
      const keyMatch = createShortcutKey(shortcut.key, shortcut.modifiers || {}) === shortcutKey;
      
      if (keyMatch) {
        // Check additional condition
        if (shortcut.condition && !shortcut.condition()) {
          continue;
        }

        // Execute the action
        shortcut.action();
        return true;
      }
    }
    
    return false;
  },
}));

// Helper function to create shortcut key string
export const createShortcutKey = (key: string, modifiers: KeyModifiers): string => {
  const parts: string[] = [];

  if (modifiers.ctrl) parts.push("ctrl");
  if (modifiers.shift) parts.push("shift");
  if (modifiers.alt) parts.push("alt");
  if (modifiers.meta) parts.push("meta");

  parts.push(key.toLowerCase());

  return parts.join("+");
};