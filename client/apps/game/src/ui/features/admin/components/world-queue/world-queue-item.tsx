import { CheckCircle2, Copy, Loader2, Trash2 } from "lucide-react";
import type { WorldStatus } from "../../types/game-presets";
import type { WorldSeriesMetadata } from "../../utils/storage";
import { CARTRIDGE_API_BASE } from "../../constants";
import { getRemainingCooldown, isWorldOnCooldown } from "../../utils/storage";

interface WorldQueueItemProps {
  worldName: string;
  status: WorldStatus;
  metadata?: WorldSeriesMetadata;
  isConfigured: boolean;
  onRemove: () => void;
  onDeploy: () => void;
  onConfigure: () => void;
  onCreateIndexer: () => void;
  isDeploying: boolean;
  currentChain: string;
}

export const WorldQueueItem = ({
  worldName,
  status,
  metadata,
  isConfigured,
  onRemove,
  onDeploy,
  onConfigure,
  onCreateIndexer,
  isDeploying,
  currentChain,
}: WorldQueueItemProps) => {
  const metadataParts: string[] = [];
  if (metadata?.seriesName) metadataParts.push(metadata.seriesName);
  if (metadata?.seriesGameNumber) metadataParts.push(`#${metadata.seriesGameNumber}`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(worldName);
    } catch (err) {
      console.error("Failed to copy world name", err);
    }
  };

  const cooldownRemaining = getRemainingCooldown(worldName);
  const onCooldown = isWorldOnCooldown(worldName);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
        {/* World name */}
        <span className="flex-1 text-xs font-mono text-slate-700">{worldName}</span>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
          title="Copy world name"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Remove from queue"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-200" />

        {/* Status indicators and actions */}
        {status.verifying && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-200">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verifying...
          </span>
        )}

        {status.autoDeploying && !status.verifying && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-200">
            <Loader2 className="w-3 h-3 animate-spin" />
            {status.autoDeploying.stopping ? "Stopping" : "Deploying"} {status.autoDeploying.current}/
            {status.autoDeploying.total}
          </span>
        )}

        {/* Deployed status */}
        {status.deployed && !status.verifying && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Deployed
          </span>
        )}

        {/* Deploy button */}
        {!status.deployed && !status.verifying && !status.autoDeploying && (
          <button
            onClick={onDeploy}
            disabled={isDeploying}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md transition-colors"
          >
            Deploy
          </button>
        )}

        {/* Post-deployment actions */}
        {status.deployed && (
          <>
            {/* Configure button (if not configured) */}
            {!isConfigured && (
              <button
                onClick={onConfigure}
                className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
              >
                Configure
              </button>
            )}

            {/* Indexer status/button */}
            {status.indexerExists ? (
              <a
                href={`${CARTRIDGE_API_BASE}/x/${worldName}/torii`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200 hover:border-emerald-300 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Indexer On
              </a>
            ) : onCooldown ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-md border border-slate-200 cursor-not-allowed">
                Wait {Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s
              </span>
            ) : (
              <button
                onClick={onCreateIndexer}
                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200 hover:border-blue-300 transition-colors"
              >
                Create Indexer
              </button>
            )}
          </>
        )}
      </div>

      {/* Series metadata */}
      {metadataParts.length > 0 && <p className="text-[11px] text-slate-500 pl-3">Series: {metadataParts.join(" ")}</p>}
    </div>
  );
};
