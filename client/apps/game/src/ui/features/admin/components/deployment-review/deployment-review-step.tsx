import { ChevronLeft } from "lucide-react";
import type { DeploymentState, TxState } from "../../types/game-presets";
import type { GamePreset } from "../../types/game-presets";
import { GameDetailsForm } from "./game-details-form";
import { ConfigSummary } from "./config-summary";
import { DeployActions } from "./deploy-actions";

interface DeploymentReviewStepProps {
  preset: GamePreset;
  deployment: DeploymentState;
  txState: TxState;
  isWalletConnected: boolean;
  explorerTxUrl?: string;
  onBack: () => void;
  onUpdateDeployment: (updates: Partial<DeploymentState>) => void;
  onRegenerateWorldName: () => void;
  onDeploy: () => void;
  onAddToQueue: () => void;
}

export const DeploymentReviewStep = ({
  preset,
  deployment,
  txState,
  isWalletConnected,
  explorerTxUrl,
  onBack,
  onUpdateDeployment,
  onRegenerateWorldName,
  onDeploy,
  onAddToQueue,
}: DeploymentReviewStepProps) => {
  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Change game type</span>
      </button>

      {/* Selected preset banner */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
        <div className="flex items-center gap-4">
          <span className="px-4 py-2 bg-blue-600 text-white text-lg font-bold rounded-xl shadow-md">
            {preset.name}
          </span>
          <div>
            <p className="text-slate-700 font-medium">{preset.description}</p>
            <p className="text-sm text-slate-500 mt-1">{preset.tagline}</p>
          </div>
        </div>
      </div>

      {/* Game details form */}
      <GameDetailsForm
        deployment={deployment}
        onUpdate={onUpdateDeployment}
        onRegenerateWorldName={onRegenerateWorldName}
      />

      {/* Config summary */}
      <ConfigSummary preset={preset} customOverrides={deployment.customOverrides} />

      {/* Deploy actions */}
      <DeployActions
        onDeploy={onDeploy}
        onAddToQueue={onAddToQueue}
        txState={txState}
        isWalletConnected={isWalletConnected}
        explorerTxUrl={explorerTxUrl}
      />
    </div>
  );
};
