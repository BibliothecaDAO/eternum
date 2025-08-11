# Empire Management Network Visualization Implementation

## 🎯 Overview

The Empire Management screen displays an interactive network graph showing relationships between Realms and Structures,
with edges representing trades and automation flows. This document outlines the implementation approach for this
canvas-based visualization.

## 🏗️ Architecture Decision

### Technology Options Analysis

#### Option 1: Cytoscape.js (Recommended) ⭐

**Pros:**

- Mature, battle-tested graph visualization library
- Canvas-based rendering for performance
- Rich set of layout algorithms (force-directed, hierarchical, etc.)
- Excellent interaction support (pan, zoom, drag nodes)
- React wrapper available (`react-cytoscapejs`)
- Extensive styling options

**Cons:**

- Additional dependency (~350KB)
- Learning curve for API

#### Option 2: Custom Three.js Implementation

**Pros:**

- Already in your tech stack
- Full control over rendering
- Can integrate with existing 3D scenes
- WebGL performance

**Cons:**

- Significant development effort
- Need to implement graph layouts from scratch
- Complex interaction handling

#### Option 3: Pixi.js

**Pros:**

- 2D WebGL renderer, very performant
- Good for game-like interactions
- Smaller than Three.js for 2D

**Cons:**

- Another renderer to manage
- Still need to implement graph algorithms

#### Option 4: D3.js Force Simulation

**Pros:**

- Powerful and flexible
- Can render to canvas
- Great for custom visualizations

**Cons:**

- Steeper learning curve
- More low-level implementation needed

## 📋 Recommended Implementation Plan

### Phase 1: Setup and Basic Graph (Week 1)

#### 1.1 Install Dependencies

```bash
npm install cytoscape react-cytoscapejs cytoscape-fcose
npm install -D @types/cytoscape
```

#### 1.2 Create Feature Structure

```
src/ui/features/empire/
├── index.ts
├── components/
│   ├── empire-graph.tsx
│   ├── node-details-panel.tsx
│   └── edge-config-modal.tsx
├── hooks/
│   ├── use-empire-graph.ts
│   └── use-graph-interactions.ts
├── store/
│   └── empire-graph-store.ts
├── types/
│   └── graph.types.ts
└── utils/
    ├── graph-layouts.ts
    └── graph-styles.ts
```

#### 1.3 Basic Graph Component

```typescript
// src/ui/features/empire/components/empire-graph.tsx
import React, { useRef, useEffect } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { useEmpireGraphStore } from '../store/empire-graph-store';
import { graphStyles } from '../utils/graph-styles';

// Register layout algorithm
cytoscape.use(fcose);

export const EmpireGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const { nodes, edges, selectedNode, setSelectedNode } = useEmpireGraphStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Cytoscape
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(node => ({
          data: { id: node.id, label: node.label, type: node.type },
          position: node.position,
        })),
        ...edges.map(edge => ({
          data: {
            source: edge.source,
            target: edge.target,
            type: edge.type,
            label: edge.label
          },
        })),
      ],
      style: graphStyles,
      layout: {
        name: 'fcose',
        animate: true,
        randomize: false,
        fit: true,
        padding: 50,
      },
    });

    // Event handlers
    cyRef.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.id());
    });

    return () => {
      cyRef.current?.destroy();
    };
  }, [nodes, edges]);

  return (
    <div className="relative w-full h-full bg-brown/90 rounded-lg">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
```

#### 1.4 Graph Store

```typescript
// src/ui/features/empire/store/empire-graph-store.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface GraphNode {
  id: string;
  type: "realm" | "structure" | "hyperstructure";
  label: string;
  position?: { x: number; y: number };
  data: {
    entityId: number;
    owner: string;
    resources?: Record<string, number>;
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "trade" | "automation";
  label?: string;
  data: {
    resourceType?: string;
    amount?: number;
    frequency?: number;
  };
}

interface EmpireGraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: string | null;
  selectedEdge: string | null;
  viewMode: "all" | "trades" | "automation";

  // Actions
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  setViewMode: (mode: "all" | "trades" | "automation") => void;

  // Graph operations
  addNode: (node: GraphNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (edgeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
}

export const useEmpireGraphStore = create(
  subscribeWithSelector<EmpireGraphStore>((set, get) => ({
    nodes: [],
    edges: [],
    selectedNode: null,
    selectedEdge: null,
    viewMode: "all",

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),
    setSelectedEdge: (edgeId) => set({ selectedEdge: edgeId }),
    setViewMode: (mode) => set({ viewMode: mode }),

    addNode: (node) =>
      set((state) => ({
        nodes: [...state.nodes, node],
      })),

    removeNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      })),

    addEdge: (edge) =>
      set((state) => ({
        edges: [...state.edges, edge],
      })),

    removeEdge: (edgeId) =>
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
      })),

    updateNodePosition: (nodeId, position) =>
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
      })),
  })),
);
```

#### 1.5 Graph Styles

```typescript
// src/ui/features/empire/utils/graph-styles.ts
export const graphStyles = [
  {
    selector: "node",
    style: {
      "background-color": "#dfaa54",
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      width: 60,
      height: 60,
      "font-size": "12px",
      "border-width": 2,
      "border-color": "#14100D",
      color: "#14100D",
      "text-wrap": "wrap",
      "text-max-width": "50px",
    },
  },
  {
    selector: 'node[type="realm"]',
    style: {
      shape: "diamond",
      "background-color": "#dfaa54",
    },
  },
  {
    selector: 'node[type="structure"]',
    style: {
      shape: "rectangle",
      "background-color": "#582C4D",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 4,
      "border-color": "#FFA200",
      "background-color": "#FFA200",
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#776756",
      "target-arrow-color": "#776756",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      label: "data(label)",
      "font-size": "10px",
      "text-rotation": "autorotate",
    },
  },
  {
    selector: 'edge[type="trade"]',
    style: {
      "line-color": "#FE993C",
      "target-arrow-color": "#FE993C",
      "line-style": "solid",
    },
  },
  {
    selector: 'edge[type="automation"]',
    style: {
      "line-color": "#7DFFBA",
      "target-arrow-color": "#7DFFBA",
      "line-style": "dashed",
    },
  },
];
```

### Phase 2: Interactions and Details (Week 2)

#### 2.1 Enhanced Interactions

```typescript
// src/ui/features/empire/hooks/use-graph-interactions.ts
import { useCallback, useEffect } from "react";
import { Core } from "cytoscape";
import { useEmpireGraphStore } from "../store/empire-graph-store";
import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";

export const useGraphInteractions = (cy: Core | null) => {
  const { play: playClick } = useUiSounds(soundSelector.click);
  const { setSelectedNode, setSelectedEdge } = useEmpireGraphStore();

  const handleNodeClick = useCallback(
    (evt: any) => {
      const node = evt.target;
      setSelectedNode(node.id());
      playClick();
    },
    [setSelectedNode, playClick],
  );

  const handleEdgeClick = useCallback(
    (evt: any) => {
      const edge = evt.target;
      setSelectedEdge(edge.id());
      playClick();
    },
    [setSelectedEdge, playClick],
  );

  const handleNodeDragEnd = useCallback((evt: any) => {
    const node = evt.target;
    const position = node.position();
    // Update position in store
    useEmpireGraphStore.getState().updateNodePosition(node.id(), position);
  }, []);

  useEffect(() => {
    if (!cy) return;

    // Node interactions
    cy.on("tap", "node", handleNodeClick);
    cy.on("dragfree", "node", handleNodeDragEnd);

    // Edge interactions
    cy.on("tap", "edge", handleEdgeClick);

    // Context menu
    cy.on("cxttap", "node", (evt) => {
      evt.preventDefault();
      // Show context menu
    });

    return () => {
      cy.removeListener("tap");
      cy.removeListener("dragfree");
      cy.removeListener("cxttap");
    };
  }, [cy, handleNodeClick, handleEdgeClick, handleNodeDragEnd]);
};
```

#### 2.2 Node Details Panel

```typescript
// src/ui/features/empire/components/node-details-panel.tsx
import React from 'react';
import { useEmpireGraphStore } from '../store/empire-graph-store';
import { ResourceIcon } from '@/ui/design-system/molecules/resource-icon';
import Button from '@/ui/design-system/atoms/button';

export const NodeDetailsPanel: React.FC = () => {
  const { selectedNode, nodes } = useEmpireGraphStore();

  const node = nodes.find(n => n.id === selectedNode);
  if (!node) return null;

  return (
    <div className="absolute right-4 top-4 w-80 bg-brown/95 border-2 border-gold rounded-lg p-4">
      <h3 className="text-lg font-bold text-gold mb-3">{node.label}</h3>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-light-pink">Type: {node.type}</p>
        <p className="text-sm text-light-pink">Owner: {node.data.owner}</p>
      </div>

      {node.data.resources && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gold mb-2">Resources</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(node.data.resources).map(([resource, amount]) => (
              <div key={resource} className="flex items-center gap-2">
                <ResourceIcon resourceId={resource} size="sm" />
                <span className="text-sm">{amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="primary" size="sm">
          View Details
        </Button>
        <Button variant="outline" size="sm">
          Manage Routes
        </Button>
      </div>
    </div>
  );
};
```

### Phase 3: Advanced Features (Week 3)

#### 3.1 Layout Options

```typescript
// src/ui/features/empire/components/layout-controls.tsx
import React from 'react';
import { Select } from '@/ui/design-system/atoms/select';

const LAYOUT_OPTIONS = [
  { value: 'fcose', label: 'Force Directed' },
  { value: 'circle', label: 'Circle' },
  { value: 'grid', label: 'Grid' },
  { value: 'breadthfirst', label: 'Hierarchical' },
  { value: 'concentric', label: 'Concentric' },
];

export const LayoutControls: React.FC<{ onLayoutChange: (layout: string) => void }> = ({
  onLayoutChange
}) => {
  return (
    <div className="absolute top-4 left-4 bg-brown/90 p-3 rounded-lg">
      <Select
        value="fcose"
        onChange={(value) => onLayoutChange(value)}
        options={LAYOUT_OPTIONS}
      />
    </div>
  );
};
```

#### 3.2 Filter Controls

```typescript
// src/ui/features/empire/components/filter-controls.tsx
import React from 'react';
import { Tabs } from '@/ui/design-system/atoms/tab/tabs';
import { useEmpireGraphStore } from '../store/empire-graph-store';

export const FilterControls: React.FC = () => {
  const { viewMode, setViewMode } = useEmpireGraphStore();

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
      <Tabs
        value={viewMode}
        onChange={(value) => setViewMode(value as any)}
        tabs={[
          { value: 'all', label: 'All Connections' },
          { value: 'trades', label: 'Trades Only' },
          { value: 'automation', label: 'Automation Only' },
        ]}
      />
    </div>
  );
};
```

#### 3.3 Route Creation Mode

```typescript
// src/ui/features/empire/hooks/use-route-creation.ts
import { useState, useCallback } from "react";
import { Core } from "cytoscape";

export const useRouteCreation = (cy: Core | null) => {
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [sourceNode, setSourceNode] = useState<string | null>(null);
  const [routeType, setRouteType] = useState<"trade" | "automation">("trade");

  const startRouteCreation = useCallback(
    (type: "trade" | "automation") => {
      setIsCreatingRoute(true);
      setRouteType(type);
      setSourceNode(null);

      // Visual feedback
      cy?.style().selector("node").style({ opacity: 0.5 }).update();
    },
    [cy],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (!isCreatingRoute) return;

      if (!sourceNode) {
        setSourceNode(nodeId);
        // Highlight source node
        cy?.getElementById(nodeId).style({ opacity: 1 });
      } else if (nodeId !== sourceNode) {
        // Create edge
        const edgeId = `${sourceNode}-${nodeId}-${Date.now()}`;
        useEmpireGraphStore.getState().addEdge({
          id: edgeId,
          source: sourceNode,
          target: nodeId,
          type: routeType,
          data: {},
        });

        // Reset
        cancelRouteCreation();
      }
    },
    [isCreatingRoute, sourceNode, routeType, cy],
  );

  const cancelRouteCreation = useCallback(() => {
    setIsCreatingRoute(false);
    setSourceNode(null);

    // Reset visual state
    cy?.style().selector("node").style({ opacity: 1 }).update();
  }, [cy]);

  return {
    isCreatingRoute,
    sourceNode,
    routeType,
    startRouteCreation,
    handleNodeClick,
    cancelRouteCreation,
  };
};
```

### Phase 4: Performance Optimization (Week 4)

#### 4.1 Viewport Culling

```typescript
// src/ui/features/empire/utils/viewport-culling.ts
export const setupViewportCulling = (cy: Core) => {
  let renderTimeout: NodeJS.Timeout;

  const updateVisibility = () => {
    const extent = cy.extent();

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const bb = node.boundingBox();
        const isInViewport = bb.x1 < extent.x2 && bb.x2 > extent.x1 && bb.y1 < extent.y2 && bb.y2 > extent.y1;

        node.style("display", isInViewport ? "element" : "none");
      });
    });
  };

  cy.on("viewport", () => {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(updateVisibility, 100);
  });

  // Initial update
  updateVisibility();
};
```

#### 4.2 Level of Detail (LOD)

```typescript
// src/ui/features/empire/utils/level-of-detail.ts
export const setupLevelOfDetail = (cy: Core) => {
  const updateLOD = () => {
    const zoom = cy.zoom();

    cy.batch(() => {
      // Hide labels at low zoom
      if (zoom < 0.5) {
        cy.style().selector("node").style({ "text-opacity": 0 }).selector("edge").style({ "text-opacity": 0 }).update();
      } else {
        cy.style()
          .selector("node")
          .style({ "text-opacity": 1 })
          .selector("edge")
          .style({ "text-opacity": zoom > 0.8 ? 1 : 0 })
          .update();
      }

      // Simplify edges at low zoom
      if (zoom < 0.3) {
        cy.style().selector("edge").style({ "curve-style": "straight" }).update();
      } else {
        cy.style().selector("edge").style({ "curve-style": "bezier" }).update();
      }
    });
  };

  cy.on("zoom", updateLOD);
  updateLOD();
};
```

### Phase 5: Integration (Week 5)

#### 5.1 Complete Empire Management View

```typescript
// src/ui/features/empire/empire-management-view.tsx
import React, { useState } from 'react';
import { EmpireGraph } from './components/empire-graph';
import { NodeDetailsPanel } from './components/node-details-panel';
import { FilterControls } from './components/filter-controls';
import { LayoutControls } from './components/layout-controls';
import { RouteCreationToolbar } from './components/route-creation-toolbar';
import { useEmpireData } from './hooks/use-empire-data';

export const EmpireManagementView: React.FC = () => {
  const [currentLayout, setCurrentLayout] = useState('fcose');

  // Load data from game state
  useEmpireData();

  return (
    <div className="relative w-full h-full bg-dark-brown">
      {/* Main Graph */}
      <EmpireGraph layout={currentLayout} />

      {/* Controls */}
      <LayoutControls onLayoutChange={setCurrentLayout} />
      <FilterControls />
      <RouteCreationToolbar />

      {/* Details Panel */}
      <NodeDetailsPanel />

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 bg-brown/90 px-4 py-2 rounded-lg">
        <span className="text-sm text-gold">Click nodes to select • Drag to reposition • Right-click for options</span>
      </div>
    </div>
  );
};
```

#### 5.2 Navigation Integration

```typescript
// src/ui/features/world/containers/left-navigation-module.tsx
// Add to your existing navigation

import { EmpireManagementView } from '@/ui/features/empire/empire-management-view';

// In your navigation items
{
  name: 'Empire',
  icon: <NetworkIcon />,
  view: LeftView.EmpireManagement,
  component: <EmpireManagementView />,
}
```

## 🎮 Interaction Patterns

1. **Node Selection**

   - Click to select and view details
   - Multi-select with Ctrl/Cmd + Click
   - Box select by dragging

2. **Edge Creation**

   - Enter route creation mode
   - Click source node, then target
   - Configure route details in modal

3. **Graph Navigation**

   - Pan: Click and drag background
   - Zoom: Scroll wheel or pinch
   - Fit: Double-click background

4. **Context Menus**
   - Right-click nodes: View, Edit, Delete, Create Route
   - Right-click edges: View Details, Edit, Delete

## 📊 State Management

```typescript
// Sync with game state
useEffect(() => {
  const structures = usePlayerStructures();
  const trades = useActiveTrades();
  const automations = useAutomations();

  // Convert to graph format
  const nodes = structures.map(structureToNode);
  const edges = [...trades.map(tradeToEdge), ...automations.map(automationToEdge)];

  setNodes(nodes);
  setEdges(edges);
}, [structures, trades, automations]);
```

## 🚀 Performance Tips

1. **Batch Operations**: Use `cy.batch()` for multiple updates
2. **Debounce Events**: Throttle viewport and zoom events
3. **Virtual Rendering**: Hide off-screen elements
4. **Progressive Loading**: Load graph in chunks for large empires
5. **Web Workers**: Calculate layouts in background

## 📱 Responsive Design

```typescript
// Handle resize
useEffect(() => {
  const handleResize = () => {
    cy?.resize();
    cy?.fit();
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, [cy]);
```

## 🎨 Visual Polish

1. **Animations**

   - Smooth layout transitions
   - Node hover effects
   - Edge flow animations for active routes

2. **Visual Feedback**

   - Highlight connected nodes on hover
   - Pulse animation for active trades
   - Color coding for resource types

3. **Theming**
   - Consistent with game's medieval aesthetic
   - Use existing color palette
   - Custom node shapes for different structures

## 🧪 Testing Strategy

1. **Unit Tests**: Graph store logic
2. **Integration Tests**: Data sync with game state
3. **Visual Tests**: Storybook stories for different graph states
4. **Performance Tests**: Large graph rendering

This implementation provides a solid foundation for your Empire Management feature while maintaining consistency with
your existing architecture and providing excellent performance and user experience.
