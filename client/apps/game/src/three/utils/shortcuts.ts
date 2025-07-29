import { KeyboardShortcut, KeyModifiers, ShortcutContext } from "@/three/managers/shortcut-manager";
import { SceneName } from "@/three/types/common";

// Utility functions for creating shortcuts
export class ShortcutUtils {
  /**
   * Creates a simple shortcut with just a key and action
   */
  static simple(key: string, description: string, action: () => void): KeyboardShortcut {
    return {
      key,
      description,
      action: () => action(),
    };
  }

  /**
   * Creates a shortcut with modifier keys
   */
  static withModifiers(
    key: string,
    modifiers: KeyModifiers,
    description: string,
    action: (event: KeyboardEvent, context: ShortcutContext) => void
  ): KeyboardShortcut {
    return {
      key,
      modifiers,
      description,
      action,
    };
  }

  /**
   * Creates a scene-specific shortcut
   */
  static forScene(
    key: string,
    scene: SceneName | SceneName[],
    description: string,
    action: (event: KeyboardEvent, context: ShortcutContext) => void
  ): KeyboardShortcut {
    return {
      key,
      description,
      action,
      sceneRestriction: scene,
    };
  }

  /**
   * Creates a conditional shortcut that only works when a condition is met
   */
  static conditional(
    key: string,
    description: string,
    condition: (context: ShortcutContext) => boolean,
    action: (event: KeyboardEvent, context: ShortcutContext) => void
  ): KeyboardShortcut {
    return {
      key,
      description,
      condition,
      action,
    };
  }

  /**
   * Creates a shortcut for navigating to a specific scene
   */
  static navigate(key: string, targetScene: SceneName, description?: string): KeyboardShortcut {
    return {
      key,
      description: description || `Navigate to ${targetScene}`,
      action: (_, context) => context.sceneManager.switchScene(targetScene),
    };
  }

  /**
   * Creates a shortcut that cycles through a list of values
   */
  static cycle<T>(
    key: string,
    description: string,
    items: T[],
    getCurrentIndex: () => number,
    onSelect: (item: T, index: number) => void
  ): KeyboardShortcut {
    return {
      key,
      description,
      action: () => {
        if (items.length === 0) return;
        const currentIndex = getCurrentIndex();
        const nextIndex = (currentIndex + 1) % items.length;
        onSelect(items[nextIndex], nextIndex);
      },
    };
  }

  /**
   * Creates a debug shortcut (only works in development)
   */
  static debug(
    key: string,
    description: string,
    action: (event: KeyboardEvent, context: ShortcutContext) => void
  ): KeyboardShortcut {
    return {
      key,
      description: `[DEBUG] ${description}`,
      condition: () => process.env.NODE_ENV === 'development',
      action,
    };
  }
}

// Common shortcut patterns
export const CommonShortcuts = {
  // Navigation shortcuts
  ESCAPE_TO_WORLDMAP: ShortcutUtils.forScene(
    "Escape",
    SceneName.Hexception,
    "Return to world map",
    (_, context) => context.sceneManager.switchScene(SceneName.WorldMap)
  ),

  // Selection shortcuts
  SELECT_ALL: (description: string, action: () => void) =>
    ShortcutUtils.withModifiers(
      "a",
      { ctrl: true },
      `Select all ${description}`,
      () => action()
    ),

  // Toggle shortcuts
  TOGGLE_MINIMAP: ShortcutUtils.simple(
    "m",
    "Toggle minimap",
    () => {
      // This would need to be connected to actual minimap toggle
      console.log("Toggle minimap");
    }
  ),

  // Debug shortcuts (only work in development)
  DEBUG_LOG_CONTEXT: ShortcutUtils.debug(
    "F12",
    "Log current context",
    (_, context) => console.log("Current context:", context)
  ),
};

// Type-safe shortcut registration helper
export function registerShortcuts(shortcuts: KeyboardShortcut[]): void {
  const gameRenderer = (window as any).gameRenderer;
  if (!gameRenderer) {
    console.warn("GameRenderer not found. Make sure it's initialized before registering shortcuts.");
    return;
  }

  shortcuts.forEach(shortcut => {
    gameRenderer.addShortcut(shortcut);
  });
}

// Example usage patterns for documentation
export const SHORTCUT_EXAMPLES = {
  // Simple key press
  simpleExample: ShortcutUtils.simple("h", "Show help", () => console.log("Help pressed")),

  // With modifiers
  modifierExample: ShortcutUtils.withModifiers(
    "s",
    { ctrl: true },
    "Save game",
    () => console.log("Ctrl+S pressed")
  ),

  // Scene-specific
  sceneExample: ShortcutUtils.forScene(
    "Space",
    SceneName.WorldMap,
    "Pause in world map",
    () => console.log("Space in world map")
  ),

  // Conditional
  conditionalExample: ShortcutUtils.conditional(
    "Enter",
    "Attack (when in world map)",
    (context) => context.currentScene === SceneName.WorldMap,
    () => console.log("Attack!")
  ),

  // Navigation
  navigationExample: ShortcutUtils.navigate("w", SceneName.WorldMap),

  // Cycle through items
  cycleExample: ShortcutUtils.cycle(
    "Tab",
    "Cycle through armies",
    ["Army1", "Army2", "Army3"],
    () => 0, // Get current index
    (army) => console.log(`Selected ${army}`)
  ),
};