import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";

/**
 * React hook for accessing the shortcut manager instance
 *
 * @returns The centralized shortcut manager instance
 */
export const useShortcutManager = () => {
  return getShortcutManager();
};
