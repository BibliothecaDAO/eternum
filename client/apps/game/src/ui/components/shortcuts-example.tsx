import { ShortcutUtils, CommonShortcuts, registerShortcuts } from "@/three/utils/shortcuts";
import { SceneName } from "@/three/types";
import { useEffect } from "react";

/**
 * Example component showing how to add custom shortcuts
 * This demonstrates the extensible shortcut system
 */
export const ShortcutsExample = () => {
  useEffect(() => {
    // Register custom shortcuts when component mounts
    const customShortcuts = [
      // Simple shortcuts
      ShortcutUtils.simple("h", "Show help dialog", () => {
        alert("Help: Use Tab to cycle through armies/structures");
      }),

      ShortcutUtils.simple("p", "Pause game", () => {
        console.log("Game paused");
      }),

      // Shortcuts with modifiers
      ShortcutUtils.withModifiers(
        "r",
        { ctrl: true },
        "Refresh game data",
        () => {
          console.log("Refreshing game data...");
        }
      ),

      ShortcutUtils.withModifiers(
        "z",
        { ctrl: true, shift: true },
        "Redo action",
        () => {
          console.log("Redo action");
        }
      ),

      // Scene-specific shortcuts
      ShortcutUtils.forScene(
        "c",
        SceneName.WorldMap,
        "Center camera on player",
        (_, context) => {
          console.log("Centering camera in world map");
          // Access current scene context
          console.log(`Current scene: ${context.currentScene}`);
        }
      ),

      ShortcutUtils.forScene(
        "b",
        [SceneName.WorldMap, SceneName.Hexception],
        "Build mode (both scenes)",
        () => {
          console.log("Entering build mode");
        }
      ),

      // Conditional shortcuts
      ShortcutUtils.conditional(
        "Enter",
        "Action in world map (when in world map)",
        (context) => context.currentScene === SceneName.WorldMap,
        () => {
          console.log("Performing world map action");
        }
      ),

      // Navigation shortcuts
      ShortcutUtils.navigate("1", SceneName.WorldMap, "Go to world map"),
      ShortcutUtils.navigate("2", SceneName.Hexception, "Go to hex view"),

      // Cycle shortcuts
      ShortcutUtils.cycle(
        "n",
        "Cycle through notification types",
        ["info", "warning", "error", "success"],
        () => 0, // You'd store current index in state
        (type) => {
          console.log(`Switched to ${type} notifications`);
        }
      ),

      // Debug shortcuts (only work in development)
      ShortcutUtils.debug(
        "F1",
        "Debug: Log current scene",
        (_, context) => {
          console.log("Current scene:", context.currentScene);
        }
      ),

      ShortcutUtils.debug(
        "F2",
        "Debug: Log scene manager", 
        (_, context) => {
          console.log("Scene manager:", context.sceneManager);
        }
      ),

      // Common shortcuts from the library
      CommonShortcuts.ESCAPE_TO_WORLDMAP,
      CommonShortcuts.SELECT_ALL("armies", () => console.log("Selected all armies")),
      CommonShortcuts.TOGGLE_MINIMAP,
      CommonShortcuts.DEBUG_LOG_CONTEXT,
    ];

    // Register all shortcuts at once
    registerShortcuts(customShortcuts);

    // You can also add shortcuts individually
    const gameRenderer = (window as any).gameRenderer;
    if (gameRenderer) {
      gameRenderer.addShortcut(
        ShortcutUtils.simple("i", "Show inventory", () => {
          console.log("Opening inventory");
        })
      );
    }

    // Cleanup function to remove shortcuts when component unmounts
    return () => {
      if (gameRenderer) {
        // Remove specific shortcuts
        gameRenderer.removeShortcut("h");
        gameRenderer.removeShortcut("r", { ctrl: true });
        
        // You could also disable all shortcuts
        // gameRenderer.setShortcutEnabled(false);
      }
    };
  }, []);

  return null; // This component doesn't render anything
};

// Usage in your main app:
// <ShortcutsExample />