// Main shortcut manager exports
export {
  CentralizedShortcutManager,
  getShortcutManager,
} from "./centralized-shortcut-manager";

// React hooks for shortcut management
export {
  useShortcuts,
  useShortcut,
  useShortcutManager,
} from "@/hooks/shortcuts/useShortcuts";

// Re-export types from the store for convenience
export type {
  KeyboardShortcut,
  KeyModifiers,
} from "@/hooks/store/use-shortcut-store";