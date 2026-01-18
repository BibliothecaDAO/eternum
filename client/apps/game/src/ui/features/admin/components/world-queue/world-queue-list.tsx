import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { WorldStatus } from "../../types/game-presets";
import type { WorldSeriesMetadata } from "../../utils/storage";
import { getConfiguredWorlds } from "../../utils/storage";
import { WorldQueueItem } from "./world-queue-item";

interface WorldQueueListProps {
  worlds: string[];
  statuses: Record<string, WorldStatus>;
  metadata: Record<string, WorldSeriesMetadata>;
  onRemove: (worldName: string) => void;
  onDeploy: (worldName: string) => void;
  onConfigure: (worldName: string) => void;
  onCreateIndexer: (worldName: string) => void;
  isDeploying: boolean;
  currentChain: string;
}

export const WorldQueueList = ({
  worlds,
  statuses,
  metadata,
  onRemove,
  onDeploy,
  onConfigure,
  onCreateIndexer,
  isDeploying,
  currentChain,
}: WorldQueueListProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const configuredWorlds = getConfiguredWorlds();

  if (worlds.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors w-full"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Game Queue ({worlds.length})
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {[...worlds].reverse().map((worldName) => (
            <WorldQueueItem
              key={worldName}
              worldName={worldName}
              status={
                statuses[worldName] || {
                  deployed: false,
                  configured: false,
                  indexerExists: false,
                  verifying: false,
                }
              }
              metadata={metadata[worldName]}
              isConfigured={configuredWorlds.includes(worldName)}
              onRemove={() => onRemove(worldName)}
              onDeploy={() => onDeploy(worldName)}
              onConfigure={() => onConfigure(worldName)}
              onCreateIndexer={() => onCreateIndexer(worldName)}
              isDeploying={isDeploying}
              currentChain={currentChain}
            />
          ))}
        </div>
      )}
    </div>
  );
};
