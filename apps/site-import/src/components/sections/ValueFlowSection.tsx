import { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Node,
  Edge,
  MarkerType,
  ConnectionMode,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { useVelords } from "@/hooks/use-velords";
import { useFlowStore } from "@/lib/stores/flow-store";
import { StarknetProvider } from "@/hooks/starknet-provider";
import {
  Gamepad2,
  ArrowRightLeft,
  Globe,
  Layers,
  Users,
  Coins,
  type LucideIcon,
} from "lucide-react";

// Custom edge style
const edgeStyle = {
  strokeWidth: 3,
  stroke: "#10b981",
};

const animatedEdgeStyle = {
  strokeWidth: 3,
  stroke: "#3b82f6",
};

const VALUE_SOURCES = [
  {
    id: "autonomous-worlds",
    label: "Autonomous Worlds",
    description: "Eternum and other fully onchain worlds",
    icon: Globe,
    value: "Primary Revenue",
    color: "border-green-500/50",
  },
  {
    id: "trading",
    label: "Swap & NFTs",
    description: "DEX fees and trading volume",
    icon: ArrowRightLeft,
    value: "Transaction Fees",
    color: "border-blue-500/50",
  },
  {
    id: "games",
    label: "Ecosystem Games",
    description: "Loot Survivor, Blob Arena, and more",
    icon: Gamepad2,
    value: "Game Fees",
    color: "border-purple-500/50",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    description: "AMMs, bridges, and client utilization",
    icon: Layers,
    value: "Protocol Fees",
    color: "border-orange-500/50",
  },
] as const;

// Custom node component for value sources
function ValueSourceNode({
  data,
}: {
  data: {
    label: string;
    description: string;
    icon: LucideIcon;
    value?: string;
    color: string;
  };
}) {
  const Icon = data.icon;
  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg bg-background border-2 hover:border-primary transition-colors relative ${data.color}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6 text-primary flex-shrink-0" />
        <div>
          <div className="text-sm font-bold">{data.label}</div>
          <div className="text-xs text-muted-foreground max-w-[200px]">
            {data.description}
          </div>
          {data.value && (
            <div className="text-xs font-semibold text-primary mt-1">
              {data.value}
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
function VeLordsNode({
  data,
}: {
  data: { label: string; value?: number; tvl?: number; apy?: number };
}) {
  return (
    <div className="px-8 py-6 shadow-xl rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-2 border-primary relative">
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 !bg-background"
        id="input"
      />
      <div className="text-center">
        <Coins className="w-10 h-10 mx-auto mb-2 opacity-90" />
        <div className=" ">{data.label}</div>
        {data.apy && (
          <div className="text-4xl font-semibold mt-2 text-green-800 px-4 my-2">
            {data.apy.toFixed(2)}% APY
          </div>
        )}
        {data.value && (
          <div className="text-lg text-opacity-50">
            {data.value.toLocaleString()} $LORDS
          </div>
        )}
        {data.tvl && (
          <div className="text-sm opacity-90">
            TVL: $
            {data.tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        )}
        {data.apy && (
          <div className="mt-3 pt-3 border-t border-primary-foreground/20">
            <p className="text-xs opacity-80 max-w-[250px] mx-auto">
              APY is based on weekly fees from games. It is not guaranteed and
              is expected to fluctuate.
            </p>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4 !bg-background"
        id="output"
      />
    </div>
  );
}

// Custom node component for stakers
function StakersNode({ data }: { data: { label: string; rewards?: number } }) {
  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-secondary to-secondary/80 border-2 border-secondary relative">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-primary"
      />
      <div className="text-center">
        <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
        <div className="text-lg font-bold">{data.label}</div>
        {data.rewards && (
          <div className="text-sm text-muted-foreground mt-1">
            Weekly Rewards Pool
          </div>
        )}
      </div>
    </div>
  );
}

export function ValueFlowSection() {
  return (
    <StarknetProvider>
      <ValueFlowSectionContent />
    </StarknetProvider>
  );
}

function ValueFlowSectionContent() {
  const { currentAPY, tokensThisWeek, lordsLocked, tvl } = useVelords();
  const flowSnapshot = [
    {
      label: "Current APY",
      value: currentAPY ? `${currentAPY.toFixed(2)}%` : "Syncing...",
      helper: "Live rate",
    },
    {
      label: "Rewards This Week",
      value: tokensThisWeek
        ? `${tokensThisWeek.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })} LORDS`
        : "Syncing...",
      helper: "Distribution pace",
    },
    {
      label: "LORDS Locked",
      value: lordsLocked
        ? lordsLocked.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : "Syncing...",
      helper: "veLORDS stake",
    },
    {
      label: "Staking TVL",
      value: tvl
        ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "Syncing...",
      helper: "Pool depth",
    },
  ];

  // Get store methods
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);

  // Create nodes with better positioning
  const initialNodes: Node[] = useMemo(
    () => [
      // Value source nodes - arranged vertically on the left
      ...VALUE_SOURCES.map((source, index) => {
        const x = 50;
        const y = 100 + index * 120; // Space them vertically

        return {
          id: source.id,
          type: "valueSource",
          position: { x, y },
          data: source,
        };
      }),
      // veLords node - center with more space
      {
        id: "velords",
        type: "velords",
        position: { x: 500, y: 250 },
        data: {
          label: "veLORDS Staking Pool",
          value: lordsLocked,
          tvl: tvl,
          apy: currentAPY,
        },
      },
      // Stakers node on the right with more space
      {
        id: "stakers",
        type: "stakers",
        position: { x: 950, y: 250 },
        data: {
          label: "veLORDS Stakers",
          // rewards: tokensThisWeek,
        },
      },
    ],
    [lordsLocked, tvl, currentAPY]
  );

  // Create edges with proper animation
  const initialEdges: Edge[] = useMemo(
    () => [
      // From value sources to veLords
      ...VALUE_SOURCES.map((source, index) => ({
        id: `edge-${source.id}`,
        source: source.id,
        target: "velords",
        targetHandle: "input",
        type: "smoothstep",
        animated: true,
        style: {
          ...edgeStyle,
          stroke:
            index === 0
              ? "#10b981"
              : index === 1
              ? "#3b82f6"
              : index === 2
              ? "#a855f7"
              : "#f97316",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color:
            index === 0
              ? "#10b981"
              : index === 1
              ? "#3b82f6"
              : index === 2
              ? "#a855f7"
              : "#f97316",
        },
      })),
      // From veLords to stakers
      {
        id: "edge-stakers",
        source: "velords",
        sourceHandle: "output",
        target: "stakers",
        type: "smoothstep",
        animated: true,
        style: animatedEdgeStyle,
        label: tokensThisWeek
          ? `${tokensThisWeek.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })} LORDS/week`
          : "Rewards Distribution",
        labelStyle: {
          fill: "#3b82f6",
          fontWeight: 600,
          fontSize: 14,
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
    ],
    [tokensThisWeek]
  );

  // Initialize nodes and edges when they change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const nodeTypes = useMemo(
    () => ({
      valueSource: ValueSourceNode,
      velords: VeLordsNode,
      stakers: StakersNode,
    }),
    []
  );

  return (
    <motion.section
      className="realm-section container mx-auto px-4 py-16 md:py-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-10">
        <p className="realm-banner mx-auto mb-4">Value Circuit</p>
        <motion.h2
          className="realm-title text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Value Flow in the Ecosystem
        </motion.h2>
        <motion.p
          className="realm-subtitle text-base sm:text-lg max-w-3xl mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Revenue from games, trading, and infrastructure converges into veLORDS
          and cycles back to stakers.
        </motion.p>
      </div>

      <motion.div
        className="realm-panel mb-10 rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-5 sm:p-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <h3 className="realm-banner mb-4">
          Flow Snapshot
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {flowSnapshot.map((item) => (
            <div key={item.label} className="card-relic rounded-xl border border-primary/15 p-4">
              <p className="realm-sigil mb-2">
                {item.label}
              </p>
              <p className="text-lg sm:text-xl font-semibold mb-1">{item.value}</p>
              <p className="text-xs text-foreground/60">{item.helper}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="realm-panel h-[420px] sm:h-[600px] bg-background/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden shadow-lg"
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
          fitViewOptions={{ padding: 0.3, minZoom: 0.35, maxZoom: 1 }}
          defaultEdgeOptions={{
            animated: true,
            type: "smoothstep",
          }}
        >
          <Background color="#aaa" gap={16} />
        </ReactFlow>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {VALUE_SOURCES.map((source, index) => {
          const Icon = source.icon;
          return (
            <motion.div
              key={source.id}
              className="card-relic bg-background/50 backdrop-blur-sm rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
            >
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-lg mb-2">{source.label}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {source.description}
              </p>
              <div className="text-xs font-semibold text-primary">
                {source.value}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="mt-10 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <div className="text-center max-w-3xl mx-auto">
          <h3 className="realm-title text-2xl sm:text-3xl font-bold mb-3">
            Reward Loop
          </h3>
          <p className="realm-subtitle">
            Keep these three mechanics in mind when evaluating staking yield.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-6 border border-green-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-green-500">1</span>
            </div>
            <h4 className="text-xl font-bold mb-3">Revenue Generation</h4>
            <p className="text-sm text-muted-foreground">
              Game actions, swaps, and protocol usage continuously route fees
              into the ecosystem reward pipeline.
            </p>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-6 border border-blue-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-blue-500">2</span>
            </div>
            <h4 className="text-xl font-bold mb-3">Value Accumulation</h4>
            <p className="text-sm text-muted-foreground">
              Smart contracts aggregate those streams directly into veLORDS,
              making rewards responsive to ecosystem activity.
            </p>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-purple-500">3</span>
            </div>
            <h4 className="text-xl font-bold mb-3">Reward Distribution</h4>
            <p className="text-sm text-muted-foreground">
              Rewards are emitted in epochs and weighted by veLORDS position,
              letting long-term stakers capture more of the flow.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}
