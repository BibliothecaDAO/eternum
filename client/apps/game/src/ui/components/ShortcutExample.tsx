import { useShortcut, useShortcuts } from "@/utils/shortcuts";
import React, { useCallback, useMemo, useState } from "react";

/**
 * Example component demonstrating how to use the centralized shortcut system
 * from React components. For Three.js scene-specific shortcuts, use SceneShortcutManager.
 */
export const ShortcutExample: React.FC = () => {
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<"normal" | "debug">("normal");

  // Example 1: Using useShortcuts hook for multiple shortcuts with a prefix
  const increment = useCallback(() => setCount((prev) => prev + 1), []);
  const decrement = useCallback(() => setCount((prev) => prev - 1), []);
  const reset = useCallback(() => setCount(0), []);
  const canReset = useCallback(() => count !== 0, [count]);

  const shortcutsConfig = useMemo(
    () => [
      {
        id: "increment",
        key: "ArrowUp",
        description: "Increment counter",
        action: increment,
      },
      {
        id: "decrement",
        key: "ArrowDown",
        description: "Decrement counter",
        action: decrement,
      },
      {
        id: "reset",
        key: "r",
        modifiers: { ctrl: true },
        description: "Reset counter",
        action: reset,
        condition: canReset, // Only available when count is not 0
      },
    ],
    [increment, decrement, reset, canReset],
  );

  useShortcuts({
    shortcuts: shortcutsConfig,
    prefix: "shortcut-example", // All shortcuts will be prefixed with this
  });

  // Example 2: Using useShortcut hook for a single shortcut
  const toggleMode = useCallback(() => setMode((prev) => (prev === "normal" ? "debug" : "normal")), []);

  useShortcut({
    id: "toggle-mode",
    key: "t",
    modifiers: { shift: true },
    description: "Toggle debug mode",
    action: toggleMode,
  });

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Shortcut System Example</h3>

      <div className="space-y-2 mb-4">
        <div>
          Current Count: <span className="font-mono">{count}</span>
        </div>
        <div>
          Current Mode: <span className="font-mono">{mode}</span>
        </div>
      </div>

      <div className="text-sm  space-y-1">
        <div>
          <kbd>↑</kbd> - Increment
        </div>
        <div>
          <kbd>↓</kbd> - Decrement
        </div>
        <div>
          <kbd>Ctrl + R</kbd> - Reset (only when count ≠ 0)
        </div>
        <div>
          <kbd>Shift + T</kbd> - Toggle mode
        </div>
      </div>

      <div className="mt-4 text-xs ">
        <p>
          This component demonstrates both the useShortcuts hook (for multiple shortcuts with a prefix) and the
          useShortcut hook (for single shortcuts). All shortcuts are automatically cleaned up when the component
          unmounts. For scene-specific shortcuts in Three.js contexts, use SceneShortcutManager instead.
        </p>
      </div>
    </div>
  );
};
