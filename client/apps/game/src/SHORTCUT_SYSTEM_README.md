# Centralized Shortcut Manager System

## Overview

This document describes the centralized shortcut manager system implemented for the Eternum game. The system uses
Zustand for state management and provides a singleton architecture that allows shortcuts to be managed globally across
React components and Three.js scenes.

## Architecture

### Core Components

1. **`useShortcutStore`** - Zustand store that manages shortcut state
2. **`CentralizedShortcutManager`** - Singleton class that handles keyboard events and manages shortcuts
3. **`SceneShortcutManager`** - Helper class for managing shortcuts within Three.js scenes
4. **`useShortcuts`** - React hook for registering shortcuts with automatic cleanup

### Key Features

- **Singleton Pattern**: Only one instance manages all shortcuts across the app
- **Automatic Cleanup**: Shortcuts are automatically removed when components unmount or scenes switch
- **Scene Restrictions**: Shortcuts can be restricted to specific scenes
- **Conditional Shortcuts**: Shortcuts can have conditions that must be met to execute
- **React Integration**: Easy-to-use React hooks for component-based shortcut management
- **Three.js Integration**: Utility functions and classes for managing shortcuts in Three.js scenes

## Usage Examples

### From React Components

```tsx
import { useShortcuts, useShortcut } from "@/hooks/shortcuts/useShortcuts";
import { SceneName } from "@/three/types/common";

const MyComponent = () => {
  // Multiple shortcuts with automatic cleanup
  useShortcuts({
    shortcuts: [
      {
        id: "save-document",
        key: "s",
        modifiers: { ctrl: true },
        description: "Save document",
        action: () => saveDocument(),
        sceneRestriction: SceneName.WorldMap,
      },
      {
        id: "toggle-mode",
        key: "t",
        description: "Toggle mode",
        action: () => toggleMode(),
      },
    ],
    prefix: "my-component", // All shortcuts will be prefixed for easy cleanup
  });

  // Single shortcut
  useShortcut({
    id: "help",
    key: "h",
    description: "Show help",
    action: () => showHelp(),
  });

  return <div>My Component</div>;
};
```

### From Three.js Scenes

```typescript
import { SceneShortcutManager } from "@/three/utils/shortcuts";
import { SceneName } from "@/three/types/common";

export default class MyScene extends HexagonScene {
  private sceneShortcuts: SceneShortcutManager;

  constructor(/* ... */) {
    super(/* ... */);

    // Initialize shortcut manager for this scene
    this.sceneShortcuts = new SceneShortcutManager("my-scene");

    // Register shortcuts
    this.sceneShortcuts.registerShortcut({
      id: "cycle-units",
      key: "Tab",
      description: "Cycle through units",
      sceneRestriction: SceneName.WorldMap,
      condition: () => this.units.length > 0,
      action: () => this.selectNextUnit(),
    });

    this.sceneShortcuts.registerShortcut({
      id: "toggle-view",
      key: "v",
      description: "Toggle view mode",
      action: () => this.toggleView(),
    });
  }

  onSwitchOff() {
    // Clean up all shortcuts when scene is deactivated
    this.sceneShortcuts.cleanup();
  }
}
```

### Using Utility Functions

```typescript
import { registerShortcut, unregisterShortcut } from "@/three/utils/shortcuts";

// Register a shortcut
registerShortcut({
  id: "global-shortcut",
  key: "Escape",
  description: "Global escape handler",
  action: () => handleEscape(),
});

// Unregister a shortcut
unregisterShortcut("global-shortcut");
```

## Key Interfaces

### KeyboardShortcut

```typescript
interface KeyboardShortcut {
  id: string; // Unique identifier
  key: string; // Key to bind to
  modifiers?: KeyModifiers; // Ctrl, Shift, Alt, Meta
  description: string; // Human-readable description
  action: () => void; // Function to execute
  sceneRestriction?: SceneName | SceneName[]; // Restrict to specific scenes
  condition?: () => boolean; // Additional condition to check
}
```

### KeyModifiers

```typescript
interface KeyModifiers {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac, Windows key on PC
}
```

## Implementation Details

### Store Structure

The Zustand store maintains:

- A Map of shortcuts keyed by shortcut ID
- An enabled flag to temporarily disable all shortcuts
- Actions for adding, removing, and executing shortcuts

### Event Handling

- Global keydown listener captures all keyboard events
- Events are ignored when focus is on input elements
- Shortcuts are matched by key combination and executed if conditions are met

### Scene Integration

- The centralized manager is initialized with a reference to the SceneManager
- Current scene is checked when executing shortcuts with scene restrictions
- Scene-specific shortcut managers automatically prefix their shortcuts

### Memory Management

- React components automatically clean up shortcuts on unmount
- Scene shortcut managers clean up when scenes are switched
- Shortcuts can be removed by ID or by prefix for bulk operations

## Migration from Old System

The refactored scenes (worldmap.tsx and hexception.tsx) demonstrate the migration:

1. Replace `ShortcutManager` import with `SceneShortcutManager`
2. Create instance with scene name: `new SceneShortcutManager("scene-name")`
3. Use `registerShortcut()` instead of `addShortcut()`
4. Add `id` field to each shortcut configuration
5. Handle modifiers using the `modifiers` object instead of key combinations
6. Add cleanup in `onSwitchOff()` method

## Benefits

1. **Centralized Management**: All shortcuts managed in one place
2. **Memory Safety**: Automatic cleanup prevents memory leaks
3. **Type Safety**: Full TypeScript support with proper interfaces
4. **Scene Awareness**: Shortcuts can be restricted to specific scenes
5. **Developer Experience**: Easy-to-use hooks and utilities
6. **Performance**: Efficient event handling with single global listener
7. **Maintainability**: Clear separation between React and Three.js integration

## Testing

The system includes an example component (`ShortcutExample.tsx`) that demonstrates:

- Multiple shortcut registration with prefixes
- Single shortcut registration
- Scene-restricted shortcuts
- Conditional shortcuts
- Automatic cleanup on component unmount

## Future Enhancements

Potential improvements could include:

- Shortcut conflict detection and warnings
- Visual shortcut help overlay
- Shortcut customization by users
- Recording and replay of shortcut sequences
- Analytics for shortcut usage patterns
