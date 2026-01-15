import { useEffect, useRef, useState } from "react";
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
const MODIFIER_KEYS: Array<keyof KeyModifiers> = ["ctrl", "alt", "shift", "meta"];

const logShortcutDiff = (reason: string, context: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[shortcuts] config changed: ${reason}`, context);
  }
};

const areShortcutsEqual = (a: UseShortcutsConfig["shortcuts"], b: UseShortcutsConfig["shortcuts"]) => {
  if (a === b) return true;
  if (a.length !== b.length) {
    logShortcutDiff("array length", { previous: a.length, next: b.length });
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];

    if (
      left.id !== right.id ||
      left.key !== right.key ||
      left.description !== right.description ||
      left.action !== right.action ||
      left.condition !== right.condition
    ) {
      logShortcutDiff("core fields", { index: i, previous: left, next: right });
      return false;
    }

    const leftModifiers = left.modifiers ?? {};
    const rightModifiers = right.modifiers ?? {};

    for (const key of MODIFIER_KEYS) {
      if (!!leftModifiers[key] !== !!rightModifiers[key]) {
        logShortcutDiff("modifiers", { index: i, modifier: key, previous: leftModifiers, next: rightModifiers });
        return false;
      }
    }
  }

  return true;
};

export const useShortcuts = (config: UseShortcutsConfig) => {
  const shortcutManager = getShortcutManager();
  const registeredIds = useRef<string[]>([]);
  const [stableShortcuts, setStableShortcuts] = useState(config.shortcuts);

  useEffect(() => {
    if (!areShortcutsEqual(stableShortcuts, config.shortcuts)) {
      setStableShortcuts(config.shortcuts);
    }
  }, [config.shortcuts, stableShortcuts]);

  useEffect(() => {
    // Register shortcuts
    stableShortcuts.forEach((shortcutConfig) => {
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
  }, [stableShortcuts, config.prefix, shortcutManager]);
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
type SingleShortcutConfig = UseShortcutsConfig["shortcuts"][number];

export const useShortcut = ({ prefix, ...shortcutConfig }: SingleShortcutConfig & { prefix?: string }) => {
  useShortcuts({
    shortcuts: [shortcutConfig],
    prefix,
  });
};
