import { Loader2, CheckCircle2, XCircle, Rocket } from "lucide-react";
import type { TxState } from "../../types/game-presets";

interface DeployActionsProps {
  onDeploy: () => void;
  onAddToQueue: () => void;
  txState: TxState;
  isWalletConnected: boolean;
  explorerTxUrl?: string;
  validationError?: string | null;
}

export const DeployActions = ({
  onDeploy,
  onAddToQueue,
  txState,
  isWalletConnected,
  explorerTxUrl,
  validationError,
}: DeployActionsProps) => {
  const isDeploying = txState.status === "running";
  const isSuccess = txState.status === "success";
  const isError = txState.status === "error";

  const getStatusIcon = () => {
    if (isDeploying) return <Loader2 className="w-5 h-5 animate-spin" />;
    if (isSuccess) return <CheckCircle2 className="w-5 h-5 text-brilliance" />;
    if (isError) return <XCircle className="w-5 h-5 text-danger" />;
    return <Rocket className="w-5 h-5" />;
  };

  const getButtonText = () => {
    if (isDeploying) return "Deploying...";
    if (isSuccess) return "Deployed!";
    if (isError) return "Try Again";
    return "Deploy Game";
  };

  const getDisabledReason = (): string | null => {
    if (validationError) return validationError;
    if (isDeploying) return "Transaction in progress";
    if (!isWalletConnected) return "Connect your wallet to deploy";
    return null;
  };

  const disabledReason = getDisabledReason();
  const isAddToQueueDisabled = isDeploying || !!validationError;

  return (
    <div className="space-y-4">
      {/* Main action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onDeploy}
          disabled={!!disabledReason}
          className={`
            flex-1 px-6 py-4 rounded-xl font-semibold text-lg
            flex items-center justify-center gap-3
            transition-all duration-200
            ${
              disabledReason
                ? "bg-brown/50 text-gold/40 cursor-not-allowed"
                : isSuccess
                  ? "bg-brilliance hover:bg-brilliance/80 text-brown"
                  : isError
                    ? "bg-danger hover:bg-danger/80 text-white"
                    : "bg-gold hover:bg-gold/80 text-brown shadow-lg hover:shadow-xl"
            }
          `}
        >
          {getStatusIcon()}
          <span>{getButtonText()}</span>
        </button>

        <button
          onClick={onAddToQueue}
          disabled={isAddToQueueDisabled}
          className="px-6 py-4 rounded-xl font-semibold bg-brown/50 hover:bg-brown/70 text-gold border border-gold/30 hover:border-gold/50 transition-all sm:w-auto"
          title={validationError ? validationError : "Add to queue without deploying"}
        >
          Add to Queue
        </button>
      </div>

      {/* Disabled reason */}
      {disabledReason && !isDeploying && <p className="text-sm text-orange text-center">{disabledReason}</p>}

      {/* Success message */}
      {isSuccess && txState.hash && (
        <div className="p-4 bg-brilliance/10 border border-brilliance/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brilliance" />
              <span className="text-sm font-semibold text-brilliance">Game deployed successfully!</span>
            </div>
            {explorerTxUrl && (
              <a
                href={explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-gold hover:text-gold/80 underline"
              >
                View Transaction
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {isError && txState.error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-danger">Deployment failed</p>
              <p className="text-xs text-danger/80 mt-1">{txState.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
