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
import {
  Gamepad2,
  ArrowRightLeft,
  Globe,
  Layers,
  Users,
  Coins,
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

// Custom node component for value sources
function ValueSourceNode({
  data,
}: {
  data: {
    label: string;
    description: string;
    icon: any;
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
  const { currentAPY, tokensThisWeek, lordsLocked, tvl } = useVelords();

  // Get store methods
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);

  // Define value sources
  const valueSources = [
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
      description: "Loot Survivor, Blobert Arena, and more",
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
  ];

  // Create nodes with better positioning
  const initialNodes: Node[] = useMemo(
    () => [
      // Value source nodes - arranged vertically on the left
      ...valueSources.map((source, index) => {
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
    [valueSources, lordsLocked, tvl, currentAPY, tokensThisWeek]
  );

  // Create edges with proper animation
  const initialEdges: Edge[] = useMemo(
    () => [
      // From value sources to veLords
      ...valueSources.map((source, index) => ({
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
    [valueSources, currentAPY, tokensThisWeek]
  );

  // Initialize nodes and edges when they change
  useEffect(() => {
    setNodes(initialNodes);
  }, [currentAPY, lordsLocked, tvl, tokensThisWeek]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [currentAPY, lordsLocked, tvl, tokensThisWeek]);

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
      className="container mx-auto px-4 py-16 md:py-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-12">
        <motion.h2
          className="text-4xl md:text-5xl font-bold mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Value Flow in the Ecosystem
        </motion.h2>
        <motion.p
          className="text-xl text-muted-foreground max-w-3xl mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Multiple revenue streams flow into the veLORDS staking pool, creating
          sustainable rewards for stakers
        </motion.p>
      </div>

      <motion.div
        className="h-[600px] bg-background/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden shadow-lg"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <ReactFlow
          key={`${lordsLocked}-${tvl}-${currentAPY}-${tokensThisWeek}`}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.3, minZoom: 0.8, maxZoom: 1 }}
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
        {valueSources.map((source, index) => {
          const Icon = source.icon;
          return (
            <motion.div
              key={source.id}
              className="bg-background/50 backdrop-blur-sm rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
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
        className="mt-12 space-y-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div className="text-center">
          <h3 className="text-3xl font-bold mb-4">
            How Value Flows to Stakers
          </h3>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            The Realms ecosystem creates a sustainable flywheel where every
            interaction generates value for veLORDS stakers
          </p>
        </div>

        {/* Step by step process */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-6 border border-green-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-green-500">1</span>
            </div>
            <h4 className="text-xl font-bold mb-3">Revenue Generation</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Autonomous Worlds:</strong>{" "}
                Players in Eternum pay fees for actions like building, trading,
                and battling. These fees accumulate continuously as the world
                operates 24/7.
              </p>
              <p>
                <strong className="text-foreground">Trading Activity:</strong>{" "}
                Every swap on DEXs and NFT marketplace transactions generate
                fees that flow directly to the pool.
              </p>
              <p>
                <strong className="text-foreground">Game Ecosystem:</strong>{" "}
                Entry fees, in-game purchases, and tournament prizes from games
                like Loot Survivor contribute to the revenue stream.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-6 border border-blue-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-blue-500">2</span>
            </div>
            <h4 className="text-xl font-bold mb-3">Value Accumulation</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">
                  Automatic Collection:
                </strong>{" "}
                Smart contracts automatically route all fees to the veLORDS pool
                without manual intervention.
              </p>
              <p>
                <strong className="text-foreground">Compounding Effect:</strong>{" "}
                As more games and services launch, revenue sources multiply,
                creating exponential growth potential.
              </p>
              <p>
                <strong className="text-foreground">Treasury Growth:</strong>{" "}
                The pool continuously grows from multiple revenue streams,
                increasing the rewards available for distribution.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-6 border border-purple-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-purple-500">3</span>
            </div>
            <h4 className="text-xl font-bold mb-3">Reward Distribution</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Weekly Epochs:</strong>{" "}
                Rewards are calculated and distributed every week based on your
                share of the total veLORDS supply.
              </p>
              <p>
                <strong className="text-foreground">Lock Multiplier:</strong>{" "}
                Longer lock periods (up to 4 years) give you more veLORDS,
                increasing your share of weekly rewards.
              </p>
              <p>
                <strong className="text-foreground">Claim Anytime:</strong>{" "}
                Accumulated rewards can be claimed at any time, giving you
                flexibility in managing your earnings.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}
