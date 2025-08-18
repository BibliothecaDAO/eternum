import { useEffect, useRef } from "react";
import { getShortcutManager, CentralizedShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { KeyboardShortcut, KeyModifiers } from "@/hooks/store/use-shortcut-store";

interface UseShortcutsConfig {
  shortcuts: Array<{
    id: string;
    key: string;
    modifiers?: KeyModifiers;
    description: string;
    action: () => void;
    condition?: () => boolean;
  }>;
  prefix?: string; // Optional prefix for shortcut IDs to enable group cleanup
}

/**
 * React hook for managing keyboard shortcuts with automatic cleanup
 *
 * @param config Configuration object containing shortcuts to register
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   useShortcuts({
 *     shortcuts: [
 *       {
 *         id: 'save-document',
 *         key: 's',
 *         modifiers: { ctrl: true },
 *         description: 'Save document',
 *         action: () => saveDocument(),
 *         condition: () => getCurrentScene() === SceneName.WorldMap
 *       }
 *     ],
 *     prefix: 'my-component'
 *   });
 *
 *   return <div>My Component</div>;
 * };
 * ```
 */
export const useShortcuts = (config: UseShortcutsConfig) => {
  const shortcutManager = getShortcutManager();
  const registeredIds = useRef<string[]>([]);

  useEffect(() => {
    // Register shortcuts
    config.shortcuts.forEach((shortcutConfig) => {
      const fullId = config.prefix ? `${config.prefix}.${shortcutConfig.id}` : shortcutConfig.id;

      const shortcut: KeyboardShortcut = CentralizedShortcutManager.createShortcut({
        ...shortcutConfig,
        id: fullId,
      });

      shortcutManager.registerShortcut(shortcut);
      registeredIds.current.push(fullId);
    });

    // Cleanup function
    return () => {
      if (config.prefix) {
        // If prefix is provided, remove all shortcuts with that prefix
        shortcutManager.unregisterShortcutsByPrefix(config.prefix);
      } else {
        // Otherwise, remove only the specific shortcuts we registered
        registeredIds.current.forEach((id) => {
          shortcutManager.unregisterShortcut(id);
        });
      }
      registeredIds.current = [];
    };
  }, [config.shortcuts, config.prefix, shortcutManager]);
};

/**
 * React hook for accessing the shortcut manager instance
 *
 * @returns The centralized shortcut manager instance
 */
export const useShortcutManager = () => {
  return getShortcutManager();
};

/**
 * React hook for registering a single shortcut with automatic cleanup
 *
 * @param shortcutConfig Configuration for a single shortcut
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   useShortcut({
 *     id: 'toggle-mode',
 *     key: 't',
 *     description: 'Toggle mode',
 *     action: () => toggleMode(),
 *   });
 *
 *   return <div>My Component</div>;
 * };
 * ```
 */
export const useShortcut = (shortcutConfig: {
  id: string;
  key: string;
  modifiers?: KeyModifiers;
  description: string;
  action: () => void;
  condition?: () => boolean;
}) => {
  useShortcuts({
    shortcuts: [shortcutConfig],
  });
};
