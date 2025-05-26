import { useCallback } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  MarkerType,
  ConnectionMode,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { games } from "@/data/games";
import { useQuery } from "@tanstack/react-query";
import { getLordsBalance } from "@/lib/getLordsBalance";

// Custom node component for games
function GameNode({
  data,
}: {
  data: { label: string; image: string; players?: number };
}) {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-background border-2 border-primary/20 hover:border-primary transition-colors relative">
      <div className="flex items-center gap-2">
        <img
          src={data.image}
          alt={data.label}
          className="w-8 h-8 rounded object-cover"
        />
        <div>
          <div className="text-sm font-bold">{data.label}</div>
          {data.players && (
            <div className="text-xs text-muted-foreground">
              {data.players} players
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-primary"
      />
    </div>
  );
}

// Custom node component for veLords
function VeLordsNode({ data }: { data: { label: string; value?: number } }) {
  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-primary text-primary-foreground border-2 border-primary relative">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-background"
      />
      <div className="text-center">
        <div className="text-lg font-bold">{data.label}</div>
        {data.value && (
          <div className="text-2xl font-bold mt-1">
            {data.value.toLocaleString()} LORDS
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-background"
      />
    </div>
  );
}

// Custom node component for holders
function HoldersNode({ data }: { data: { label: string; count?: number } }) {
  return (
    <div className="px-6 py-3 shadow-md rounded-md bg-secondary border-2 border-secondary relative">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-primary"
      />
      <div className="text-center">
        <div className="text-sm font-bold">{data.label}</div>
        {data.count && (
          <div className="text-lg font-semibold">
            {data.count.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  game: GameNode,
  velords: VeLordsNode,
  holders: HoldersNode,
};

// Custom edge style
const edgeStyle = {
  strokeWidth: 3,
  stroke: "#10b981",
};

const animatedEdgeStyle = {
  strokeWidth: 3,
  stroke: "#3b82f6",
};

export function ValueFlowSection() {
  const { data: veLordsSupply } = useQuery({
    queryKey: ["veLordsSupply"],
    queryFn: getLordsBalance,
  });

  // Filter only specific games: Realms and Loot Survivor
  const selectedGames = games.filter(
    (game) => game.slug === "realms-eternum" || game.slug === "loot-survivor"
  );

  // Create nodes with better positioning
  const initialNodes: Node[] = [
    // Game nodes - arranged vertically on the left
    ...selectedGames.map((game, index) => {
      const x = 100;
      const y = 250 + index * 100; // Space them vertically

      return {
        id: `game-${game.id}`,
        type: "game",
        position: { x, y },
        data: {
          label: game.title,
          image: game.image,
          players: game.players,
        },
      };
    }),
    // veLords node - center
    {
      id: "velords",
      type: "velords",
      position: { x: 450, y: 300 },
      data: {
        label: "veLORDS Pool",
        value: veLordsSupply,
      },
    },
    // Single stakers node on the right
    {
      id: "stakers",
      type: "holders",
      position: { x: 800, y: 300 },
      data: { label: "Stakers", count: 2590 }, // Combined count
    },
  ];

  // Create edges with proper animation
  const initialEdges: Edge[] = [
    // From games to veLords
    ...selectedGames.map((game, index) => ({
      id: `edge-game-${game.id}`,
      source: `game-${game.id}`,
      target: "velords",
      type: "smoothstep",
      animated: true,
      style: edgeStyle,
      label: index === 0 ? "24hr: 12,450 LORDS" : "24hr: 8,320 LORDS", // Dynamic values to be added
      labelStyle: {
        fill: "#10b981",
        fontWeight: 600,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: "rgba(0, 0, 0, 0.8)",
        fillOpacity: 0.8,
      },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: "#10b981",
      },
    })),
    // From veLords to stakers
    {
      id: "edge-stakers",
      source: "velords",
      target: "stakers",
      type: "smoothstep",
      animated: true,
      style: animatedEdgeStyle,
      label: "APY: 12.5%", // Dynamic value to be added
      labelStyle: {
        fill: "#3b82f6",
        fontWeight: 600,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: "rgba(0, 0, 0, 0.8)",
        fillOpacity: 0.8,
      },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: "#3b82f6",
      },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <motion.section
      className="container mx-auto px-4 py-12 md:py-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-8">
        <motion.h2
          className="text-3xl md:text-4xl font-bold mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Value Flow in the Ecosystem
        </motion.h2>
        <motion.p
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Watch how value flows from games through the veLORDS pool to stakers
        </motion.p>
      </div>

      <motion.div
        className="h-[600px] bg-background/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
          defaultEdgeOptions={{
            animated: true,
            type: "smoothstep",
          }}
        >
          <Background color="#aaa" gap={16} />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "velords") return "#10b981";
              if (node.type === "holders") return "#3b82f6";
              return "#6b7280";
            }}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.1)",
            }}
          />
          <Controls />
        </ReactFlow>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-4 h-4 bg-primary/20 rounded border-2 border-primary/20"></div>
            <h3 className="font-semibold">Key Games</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Realms: Eternum and Loot Survivor - flagship games generating
            significant value in the ecosystem
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-4 h-4 bg-primary rounded"></div>
            <h3 className="font-semibold">veLORDS Pool</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Central staking pool where LORDS tokens are locked to capture value
            from the ecosystem
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-4 h-4 bg-secondary rounded"></div>
            <h3 className="font-semibold">Stakers</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Token holders who stake their LORDS to earn rewards and participate
            in governance
          </p>
        </div>
      </motion.div>
    </motion.section>
  );
}
