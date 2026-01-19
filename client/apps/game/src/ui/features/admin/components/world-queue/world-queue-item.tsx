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
      <div className="flex items-center gap-2 px-3 py-2 panel-wood rounded-lg border border-gold/20 hover:border-gold/40 transition-colors">
        {/* World name */}
        <span className="flex-1 text-xs font-mono text-gold">{worldName}</span>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="p-1 text-gold/40 hover:text-gold hover:bg-brown/30 rounded transition-colors"
          title="Copy world name"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="p-1 text-gold/40 hover:text-danger hover:bg-danger/10 rounded transition-colors"
          title="Remove from queue"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-gold/20" />

        {/* Status indicators and actions */}
        {status.verifying && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-gold/20 text-gold text-xs font-semibold rounded border border-gold/30">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verifying...
          </span>
        )}

        {status.autoDeploying && !status.verifying && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-gold/20 text-gold text-xs font-semibold rounded border border-gold/30">
            <Loader2 className="w-3 h-3 animate-spin" />
            {status.autoDeploying.stopping ? "Stopping" : "Deploying"} {status.autoDeploying.current}/
            {status.autoDeploying.total}
          </span>
        )}

        {/* Deployed status */}
        {status.deployed && !status.verifying && (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-brilliance/20 text-brilliance text-xs font-semibold rounded border border-brilliance/30">
            <CheckCircle2 className="w-3 h-3" />
            Deployed
          </span>
        )}

        {/* Deploy button */}
        {!status.deployed && !status.verifying && !status.autoDeploying && (
          <button
            onClick={onDeploy}
            disabled={isDeploying}
            className="px-3 py-1 bg-gold hover:bg-gold/80 disabled:bg-brown/50 disabled:text-gold/40 disabled:cursor-not-allowed text-brown text-xs font-semibold rounded-md transition-colors"
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
                className="px-3 py-1 bg-brown/50 hover:bg-brown/70 text-gold text-xs font-semibold rounded-md border border-gold/30 hover:border-gold/50 transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-1 bg-brilliance/20 hover:bg-brilliance/30 text-brilliance text-xs font-semibold rounded-md border border-brilliance/30 hover:border-brilliance/50 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brilliance" />
                Indexer On
              </a>
            ) : onCooldown ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-brown/50 text-gold/60 text-xs font-semibold rounded-md border border-gold/20 cursor-not-allowed">
                Wait {Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s
              </span>
            ) : (
              <button
                onClick={onCreateIndexer}
                className="px-3 py-1 bg-gold/20 hover:bg-gold/30 text-gold text-xs font-semibold rounded-md border border-gold/30 hover:border-gold/50 transition-colors"
              >
                Create Indexer
              </button>
            )}
          </>
        )}
      </div>

      {/* Series metadata */}
      {metadataParts.length > 0 && <p className="text-[11px] text-gold/60 pl-3">Series: {metadataParts.join(" ")}</p>}
    </div>
  );
};
