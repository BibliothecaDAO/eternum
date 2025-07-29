import { SceneManager } from "../scene-manager";
import { SceneName } from "../types";

// Define modifier keys
export interface KeyModifiers {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac, Windows key on PC
}

// Define a keyboard shortcut
export interface KeyboardShortcut {
  key: string;
  modifiers?: KeyModifiers;
  description: string;
  action: (event: KeyboardEvent, context: ShortcutContext) => void;
  sceneRestriction?: SceneName | SceneName[]; // Restrict to specific scenes
  condition?: (context: ShortcutContext) => boolean; // Additional condition to check
}

// Context passed to shortcut actions
export interface ShortcutContext {
  sceneManager: SceneManager;
  currentScene: SceneName;
}

export class ShortcutManager {
  private enabled: boolean = true;
  private sceneManager: SceneManager;
  private shortcuts: Map<string, KeyboardShortcut> = new Map();

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.setupDefaultShortcuts();
    this.setupKeyboardListeners();
  }

  private setupDefaultShortcuts() {}

  private setupKeyboardListeners() {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this.enabled) return;

    // Check if the event target is an input element
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const shortcutKey = this.createShortcutKey(event.key, {
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    });

    const shortcut = this.shortcuts.get(shortcutKey);
    console.log("shortcut", shortcut);
    if (shortcut) {
      // Check scene restriction
      if (shortcut.sceneRestriction) {
        const currentScene = this.sceneManager.getCurrentScene();
        if (!currentScene) return;

        const allowedScenes = Array.isArray(shortcut.sceneRestriction)
          ? shortcut.sceneRestriction
          : [shortcut.sceneRestriction];

        if (!allowedScenes.includes(currentScene)) {
          return;
        }
      }

      // Check additional condition
      if (shortcut.condition) {
        const context = this.createContext();
        if (!shortcut.condition(context)) {
          return;
        }
      }

      event.preventDefault();
      const context = this.createContext();
      shortcut.action(event, context);
    }
  }

  private createShortcutKey(key: string, modifiers: KeyModifiers): string {
    const parts: string[] = [];

    if (modifiers.ctrl) parts.push("ctrl");
    if (modifiers.shift) parts.push("shift");
    if (modifiers.alt) parts.push("alt");
    if (modifiers.meta) parts.push("meta");

    parts.push(key.toLowerCase());

    return parts.join("+");
  }

  private createContext(): ShortcutContext {
    return {
      sceneManager: this.sceneManager,
      currentScene: this.sceneManager.getCurrentScene() || SceneName.WorldMap,
    };
  }

  // Public API for adding shortcuts
  public addShortcut(shortcut: KeyboardShortcut): void {
    const key = this.createShortcutKey(shortcut.key, shortcut.modifiers || {});
    this.shortcuts.set(key, shortcut);
    console.log(`Added shortcut: ${key} - ${shortcut.description}`);
  }

  // Public API for removing shortcuts
  public removeShortcut(key: string, modifiers?: KeyModifiers): void {
    const shortcutKey = this.createShortcutKey(key, modifiers || {});
    if (this.shortcuts.delete(shortcutKey)) {
      console.log(`Removed shortcut: ${shortcutKey}`);
    }
  }

  // Public API for getting all shortcuts
  public getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  // Public API for getting shortcuts by scene
  public getShortcutsForScene(scene: SceneName): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter((shortcut) => {
      if (!shortcut.sceneRestriction) return true;
      const allowedScenes = Array.isArray(shortcut.sceneRestriction)
        ? shortcut.sceneRestriction
        : [shortcut.sceneRestriction];
      return allowedScenes.includes(scene);
    });
  }

  // Helper method to create shortcuts for external use
  public static createShortcut(options: {
    key: string;
    modifiers?: KeyModifiers;
    description: string;
    action: (event: KeyboardEvent, context: ShortcutContext) => void;
    sceneRestriction?: SceneName | SceneName[];
    condition?: (context: ShortcutContext) => boolean;
  }): KeyboardShortcut {
    return {
      key: options.key,
      modifiers: options.modifiers,
      description: options.description,
      action: options.action,
      sceneRestriction: options.sceneRestriction,
      condition: options.condition,
    };
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public destroy() {
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }
}
