import { Loader2, CheckCircle2, XCircle, Rocket } from "lucide-react";
import type { TxState } from "../../types/game-presets";

interface DeployActionsProps {
  onDeploy: () => void;
  onAddToQueue: () => void;
  txState: TxState;
  isWalletConnected: boolean;
  explorerTxUrl?: string;
}

export const DeployActions = ({
  onDeploy,
  onAddToQueue,
  txState,
  isWalletConnected,
  explorerTxUrl,
}: DeployActionsProps) => {
  const isDeploying = txState.status === "running";
  const isSuccess = txState.status === "success";
  const isError = txState.status === "error";

  const getStatusIcon = () => {
    if (isDeploying) return <Loader2 className="w-5 h-5 animate-spin" />;
    if (isSuccess) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (isError) return <XCircle className="w-5 h-5 text-red-500" />;
    return <Rocket className="w-5 h-5" />;
  };

  const getButtonText = () => {
    if (isDeploying) return "Deploying...";
    if (isSuccess) return "Deployed!";
    if (isError) return "Try Again";
    return "Deploy Game";
  };

  const getDisabledReason = (): string | null => {
    if (isDeploying) return "Transaction in progress";
    if (!isWalletConnected) return "Connect your wallet to deploy";
    return null;
  };

  const disabledReason = getDisabledReason();

  return (
    <div className="space-y-4">
      {/* Main action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onDeploy}
          disabled={!!disabledReason}
          className={`
            flex-1 px-6 py-4 rounded-xl font-semibold text-lg
            flex items-center justify-center gap-3
            transition-all duration-200
            ${
              disabledReason
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : isSuccess
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : isError
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl"
            }
          `}
        >
          {getStatusIcon()}
          <span>{getButtonText()}</span>
        </button>

        <button
          onClick={onAddToQueue}
          disabled={isDeploying}
          className="px-6 py-4 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200 hover:border-slate-300 transition-all"
          title="Add to queue without deploying"
        >
          Add to Queue
        </button>
      </div>

      {/* Disabled reason */}
      {disabledReason && !isDeploying && (
        <p className="text-sm text-amber-600 text-center">{disabledReason}</p>
      )}

      {/* Success message */}
      {isSuccess && txState.hash && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-900">Game deployed successfully!</span>
            </div>
            {explorerTxUrl && (
              <a
                href={explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline"
              >
                View Transaction
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {isError && txState.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Deployment failed</p>
              <p className="text-xs text-red-700 mt-1">{txState.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
