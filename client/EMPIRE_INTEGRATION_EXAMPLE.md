# Quick Integration Example

To add the Empire Management screen to your existing navigation:

## 1. First install Cytoscape

```bash
npm install cytoscape react-cytoscapejs cytoscape-fcose
npm install -D @types/cytoscape
```

## 2. Add to your LeftView enum

In `src/types/index.ts`, add:

```typescript
export enum LeftView {
  // ... existing views
  EmpireManagement = "EmpireManagement",
}
```

## 3. Update your left navigation

In `src/ui/features/world/containers/left-navigation-module.tsx`:

```typescript
// Add import at the top
import { EmpireGraphMinimal } from "@/ui/features/empire";

// In your navigation items array (around line 96), add:
{
  key: "empire",
  icon: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  label: "Empire",
  action: () => {
    toggleView(LeftView.EmpireManagement);
  },
  active: view === LeftView.EmpireManagement,
  disabled: navigationViewsDisabled.includes(LeftView.EmpireManagement),
}

// In your view rendering switch statement, add:
case LeftView.EmpireManagement:
  return (
    <BaseContainer className="min-h-[400px]">
      <EmpireGraphMinimal />
    </BaseContainer>
  );
```

## 4. Create the minimal component

The minimal component is already created at: `src/ui/features/empire/components/empire-graph-minimal.tsx`

## 5. Run and test

The Empire Management view should now be accessible from your left navigation menu!

## Next Steps

1. **Enhance the graph data**: Connect to your actual game state
2. **Add interactions**: Node details, edge creation, etc.
3. **Implement filters**: Show/hide trades vs automation
4. **Add animations**: Make it feel alive with subtle animations
5. **Performance optimization**: Implement viewport culling for large graphs

The full implementation guide in `EMPIRE_MANAGEMENT_IMPLEMENTATION.md` covers all these advanced features in detail.
