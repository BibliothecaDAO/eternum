import { useShortcutStore, KeyboardShortcut, KeyModifiers, createShortcutKey } from "@/hooks/store/use-shortcut-store";

/**
 * Centralized Shortcut Manager - Singleton class that manages keyboard shortcuts
 * across the entire application using Zustand store for state management.
 * 
 * This manager is completely scene-agnostic and framework-agnostic.
 * It simply handles keyboard events and executes registered shortcuts.
 */
export class CentralizedShortcutManager {
  private static instance: CentralizedShortcutManager | null = null;
  private keydownHandler: (event: KeyboardEvent) => void;

  private constructor() {
    this.keydownHandler = this.handleKeyDown.bind(this);
    this.setupKeyboardListeners();
  }

  /**
   * Get the singleton instance of the shortcut manager
   */
  public static getInstance(): CentralizedShortcutManager {
    if (!CentralizedShortcutManager.instance) {
      CentralizedShortcutManager.instance = new CentralizedShortcutManager();
    }
    return CentralizedShortcutManager.instance;
  }

  /**
   * Set up keyboard event listeners
   */
  private setupKeyboardListeners(): void {
    window.addEventListener("keydown", this.keydownHandler);
  }

  /**
   * Handle keyboard events and execute matching shortcuts
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Check if the event target is an input element
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const shortcutKey = createShortcutKey(event.key, {
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
    });

    // Try to execute shortcut through the store
    const executed = useShortcutStore.getState().executeShortcut(shortcutKey);
    
    if (executed) {
      event.preventDefault();
    }
  }

  /**
   * Register a new shortcut
   */
  public registerShortcut(shortcut: KeyboardShortcut): void {
    useShortcutStore.getState().addShortcut(shortcut);
    console.log(`Registered shortcut: ${shortcut.id} (${shortcut.key}) - ${shortcut.description}`);
  }

  /**
   * Unregister a shortcut by ID
   */
  public unregisterShortcut(shortcutId: string): void {
    useShortcutStore.getState().removeShortcut(shortcutId);
    console.log(`Unregistered shortcut: ${shortcutId}`);
  }

  /**
   * Unregister all shortcuts with a specific prefix (useful for cleanup)
   */
  public unregisterShortcutsByPrefix(prefix: string): void {
    useShortcutStore.getState().removeShortcutsByPrefix(prefix);
    console.log(`Unregistered shortcuts with prefix: ${prefix}`);
  }

  /**
   * Get all registered shortcuts
   */
  public getShortcuts(): KeyboardShortcut[] {
    return useShortcutStore.getState().getShortcuts();
  }


  /**
   * Enable or disable shortcut handling
   */
  public setEnabled(enabled: boolean): void {
    useShortcutStore.getState().setEnabled(enabled);
  }

  /**
   * Clear all shortcuts
   */
  public clearAllShortcuts(): void {
    useShortcutStore.getState().clearAllShortcuts();
  }

  /**
   * Helper method to create a shortcut configuration
   */
  public static createShortcut(config: {
    id: string;
    key: string;
    modifiers?: KeyModifiers;
    description: string;
    action: () => void;
    condition?: () => boolean;
  }): KeyboardShortcut {
    return {
      id: config.id,
      key: config.key,
      modifiers: config.modifiers,
      description: config.description,
      action: config.action,
      condition: config.condition,
    };
  }

  /**
   * Destroy the shortcut manager and clean up listeners
   */
  public destroy(): void {
    window.removeEventListener("keydown", this.keydownHandler);
    this.clearAllShortcuts();
    CentralizedShortcutManager.instance = null;
  }
}

/**
 * Convenience function to get the singleton instance
 */
export const getShortcutManager = (): CentralizedShortcutManager => {
  return CentralizedShortcutManager.getInstance();
};