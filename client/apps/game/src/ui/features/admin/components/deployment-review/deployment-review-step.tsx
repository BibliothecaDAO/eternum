import { ChevronLeft, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { DeploymentState, GamePresetConfigOverrides, TxState } from "../../types/game-presets";
import type { GamePreset } from "../../types/game-presets";
import { GameDetailsForm } from "./game-details-form";
import { ConfigSummary } from "./config-summary";
import { ConfigEditor } from "./config-editor";
import { DeployActions } from "./deploy-actions";
import { isValidDecimalAmount } from "../../utils/preset-to-config";

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
  // Show config editor by default for custom preset, or when user clicks Edit
  const isCustomPreset = preset.id === "custom";
  const [showConfigEditor, setShowConfigEditor] = useState(isCustomPreset);

  // Merge preset defaults with custom overrides for the editor
  const effectiveConfig: GamePresetConfigOverrides = {
    ...preset.configOverrides,
    ...deployment.customOverrides,
  };
  const feeError =
    effectiveConfig.hasFee && !isValidDecimalAmount(effectiveConfig.feeAmount, effectiveConfig.feePrecision)
      ? `Enter a valid amount with up to ${effectiveConfig.feePrecision} decimals.`
      : null;

  const handleConfigChange = (updates: Partial<GamePresetConfigOverrides>) => {
    onUpdateDeployment({
      customOverrides: {
        ...deployment.customOverrides,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-gold/70 hover:text-gold transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Change game type</span>
      </button>

      {/* Selected preset banner */}
      <div className="p-6 panel-wood rounded-xl border border-gold/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="px-4 py-2 bg-gold text-brown text-lg font-bold rounded-xl shadow-md">{preset.name}</span>
            <div>
              <p className="text-gold font-medium">{preset.description}</p>
              <p className="text-sm text-gold/60 mt-1">{preset.tagline}</p>
            </div>
          </div>
          {!isCustomPreset && (
            <button
              onClick={() => setShowConfigEditor(!showConfigEditor)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-semibold
                ${showConfigEditor ? "bg-gold/20 border-gold/50 text-gold" : "bg-brown/50 border-gold/20 text-gold/70 hover:border-gold/40"}
              `}
            >
              {showConfigEditor ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {showConfigEditor ? "Use Defaults" : "Customize"}
            </button>
          )}
        </div>
      </div>

      {/* Game details form */}
      <GameDetailsForm
        deployment={deployment}
        onUpdate={onUpdateDeployment}
        onRegenerateWorldName={onRegenerateWorldName}
      />

      {/* Config editor (shown for custom preset or when editing) */}
      {showConfigEditor ? (
        <ConfigEditor config={effectiveConfig} onChange={handleConfigChange} feeError={feeError} />
      ) : (
        <ConfigSummary preset={preset} customOverrides={deployment.customOverrides} />
      )}

      {/* Deploy actions */}
      <DeployActions
        onDeploy={onDeploy}
        onAddToQueue={onAddToQueue}
        txState={txState}
        isWalletConnected={isWalletConnected}
        explorerTxUrl={explorerTxUrl}
        validationError={feeError}
      />
    </div>
  );
};
