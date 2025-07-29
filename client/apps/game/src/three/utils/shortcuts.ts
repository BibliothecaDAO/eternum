import { KeyModifiers } from "@/hooks/store/use-shortcut-store";
import { CentralizedShortcutManager, getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { SceneName } from "@/three/types/common";
import { SceneManager } from "@/three/scene-manager";

/**
 * Register a shortcut from a Three.js scene or other non-React context
 */
export const registerShortcut = (config: {
  id: string;
  key: string;
  modifiers?: KeyModifiers;
  description: string;
  action: () => void;
  condition?: () => boolean;
}): void => {
  const shortcut = CentralizedShortcutManager.createShortcut(config);
  getShortcutManager().registerShortcut(shortcut);
};

/**
 * Unregister a shortcut by ID
 */
export const unregisterShortcut = (shortcutId: string): void => {
  getShortcutManager().unregisterShortcut(shortcutId);
};

/**
 * Unregister all shortcuts with a specific prefix
 */
export const unregisterShortcutsByPrefix = (prefix: string): void => {
  getShortcutManager().unregisterShortcutsByPrefix(prefix);
};

/**
 * Helper class for managing shortcuts within a Three.js scene
 * This class handles the Scene Manager dependency and provides convenient methods
 * for registering shortcuts with automatic scene prefixing and scene restrictions
 */
export class SceneShortcutManager {
  private scenePrefix: string;
  private registeredShortcuts: Set<string> = new Set();
  private sceneManager: SceneManager | null = null;

  constructor(sceneName: string, sceneManager?: SceneManager) {
    this.scenePrefix = sceneName.toLowerCase();
    this.sceneManager = sceneManager || null;
  }

  /**
   * Check if the current scene matches the allowed scenes for a shortcut
   */
  private isCurrentSceneAllowed(allowedScenes: SceneName | SceneName[]): boolean {
    if (!this.sceneManager) return true; // Allow if no scene manager
    
    const currentScene = this.sceneManager.getCurrentScene();
    if (!currentScene) return true; // Allow if no current scene
    
    const scenesToCheck = Array.isArray(allowedScenes) ? allowedScenes : [allowedScenes];
    return scenesToCheck.includes(currentScene);
  }

  /**
   * Set the scene manager (useful if not provided in constructor)
   */
  public setSceneManager(sceneManager: SceneManager): void {
    this.sceneManager = sceneManager;
  }

  public registerShortcut(config: {
    id: string;
    key: string;
    modifiers?: KeyModifiers;
    description: string;
    action: () => void;
    sceneRestriction?: SceneName | SceneName[];
    condition?: () => boolean;
  }): void {
    const fullId = `${this.scenePrefix}.${config.id}`;

    // Don't register if already registered (prevents duplicates)
    if (this.registeredShortcuts.has(fullId)) {
      return;
    }

    // Create a combined condition that includes scene restriction
    const combinedCondition = () => {
      // First check the original condition if it exists
      if (config.condition && !config.condition()) {
        return false;
      }
      
      // Then check scene restriction if it exists
      if (config.sceneRestriction && !this.isCurrentSceneAllowed(config.sceneRestriction)) {
        return false;
      }
      
      return true;
    };

    registerShortcut({
      id: fullId,
      key: config.key,
      modifiers: config.modifiers,
      description: config.description,
      action: config.action,
      condition: config.sceneRestriction || config.condition ? combinedCondition : undefined,
    });

    this.registeredShortcuts.add(fullId);
  }

  public cleanup(): void {
    this.registeredShortcuts.forEach((id) => {
      unregisterShortcut(id);
    });
    this.registeredShortcuts.clear();
  }

  public hasShortcuts(): boolean {
    return this.registeredShortcuts.size > 0;
  }

  public getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts);
  }
}

// Utility functions for creating shortcuts with the new system
export class ShortcutUtils {
  static simple(id: string, key: string, description: string, action: () => void) {
    return {
      id,
      key,
      description,
      action,
    };
  }

  static withModifiers(id: string, key: string, modifiers: KeyModifiers, description: string, action: () => void) {
    return {
      id,
      key,
      modifiers,
      description,
      action,
    };
  }


  static conditional(id: string, key: string, description: string, condition: () => boolean, action: () => void) {
    return {
      id,
      key,
      description,
      condition,
      action,
    };
  }

  static cycle<T>(
    id: string,
    key: string,
    description: string,
    items: T[],
    getCurrentIndex: () => number,
    onSelect: (item: T, index: number) => void,
  ) {
    return {
      id,
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
}
