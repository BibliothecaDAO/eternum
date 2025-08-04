# Label System Refactoring

This directory now contains a refactored label system that provides better code organization, reusability, and extensibility.

## Architecture Overview

The label system has been refactored into several focused modules:

### Core Architecture
- **`label-types.ts`** - TypeScript interfaces and type definitions
- **`label-config.ts`** - Configuration, styles, and settings
- **`label-manager.ts`** - Generic label manager class for advanced use cases
- **`label-factory.ts`** - Pre-built label types and creation functions
- **`label-components.ts`** - Reusable UI components and utilities

### Legacy Support
- **`label-utils.ts`** - Backward compatibility layer (DEPRECATED)

## Usage

### For Existing Code (Backward Compatible)
All existing imports continue to work without changes:

```typescript
import { createArmyLabel, createStructureLabel, createChestLabel } from "../utils/";
```

### For New Code (Recommended)
Use the new factory system for better type safety:

```typescript
import { LabelManager } from "../utils/label-manager";
import { ArmyLabelType, StructureLabelType } from "../utils/label-factory";

// Create a label manager
const labelManager = new LabelManager({
  labelsGroup: scene.labelsGroup,
  initialCameraView: CameraView.Medium
});

// Register label types
labelManager.registerLabelType(ArmyLabelType);
labelManager.registerLabelType(StructureLabelType);

// Create labels
labelManager.createLabel("army", armyData);
labelManager.createLabel("structure", structureData);
```

## Benefits of the New System

### 1. **Code Clarity**
- Each module has a single, well-defined responsibility
- Type-safe interfaces for all label operations
- Clear separation between configuration, logic, and presentation

### 2. **Reusability** 
- Shared components can be used across different label types
- Common functionality is centralized and reusable
- No code duplication between managers

### 3. **Extensibility**
- Adding new label types requires only configuration changes
- Plugin system for custom label behaviors
- Easy to modify existing label types without touching core logic

### 4. **Consistency**
- Standardized APIs across all managers
- Consistent styling and behavior patterns
- Unified configuration system

### 5. **Memory Management**
- Proper cleanup of DOM elements and event listeners
- Automatic timeout management for transitions
- Prevention of memory leaks

## Migration Guide

### For Manager Classes
Existing manager classes require minimal changes:

1. Keep existing imports - they work via the compatibility layer
2. Replace direct DOM manipulation with label manager calls (optional)
3. Use the new update functions for better performance (optional)

### For New Label Types
To create a new label type:

1. Define the data interface in `label-types.ts`
2. Create the label type definition in `label-factory.ts`
3. Add any new components to `label-components.ts`
4. Configure styling in `label-config.ts`

## File Structure

```
/three/utils/
├── label-types.ts          # TypeScript interfaces
├── label-config.ts         # Configuration & styles  
├── label-manager.ts        # Core manager class
├── label-factory.ts        # Pre-built label types
├── label-components.ts     # Reusable components
├── label-utils.ts          # Legacy compatibility (DEPRECATED)
└── README-LABELS.md        # This documentation
```

## Implementation Status

✅ **Completed:**
- Core architecture files created
- Component extraction and reorganization
- Generic label factory system
- Backward compatibility layer
- Manager integration updates

The refactoring maintains 100% backward compatibility while providing a modern, extensible foundation for future label development.