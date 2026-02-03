/**
 * Inline registration button for factory games in the world selector.
 * Shows registration status, fee info, and handles the full registration flow.
 */
import type { WorldConfigMeta } from "@/hooks/use-world-availability";
import { useWorldRegistration, type RegistrationStage } from "@/hooks/use-world-registration";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import { useCallback } from "react";

interface WorldRegistrationButtonProps {
  worldName: string;
  chain: Chain;
  config: WorldConfigMeta | null;
  isRegistered: boolean;
  isOnline: boolean;
  onRegistrationComplete?: () => void;
}

const formatFeeAmount = (amount: bigint): string => {
  // Convert from wei to human-readable (assuming 18 decimals)
  const divisor = 10n ** 18n;
  const whole = amount / divisor;
  const remainder = amount % divisor;

  if (remainder === 0n) {
    return whole.toString();
  }

  // Show up to 2 decimal places
  const decimal = (remainder * 100n) / divisor;
  if (decimal === 0n) {
    return whole.toString();
  }

  return `${whole}.${decimal.toString().padStart(2, "0")}`;
};

const getStageLabel = (stage: RegistrationStage): string => {
  switch (stage) {
    case "obtaining-token":
      return "Obtaining token...";
    case "waiting-for-token":
      return "Confirming...";
    case "registering":
      return "Registering...";
    case "done":
      return "Registered";
    case "error":
      return "Failed";
    default:
      return "Register";
  }
};

export const WorldRegistrationButton = ({
  worldName,
  chain,
  config,
  isRegistered,
  isOnline,
  onRegistrationComplete,
}: WorldRegistrationButtonProps) => {
  const { address } = useAccount();

  const { register, registrationStage, isRegistering, error, requiresEntryToken, feeAmount, canRegister } =
    useWorldRegistration({
      worldName,
      chain,
      config,
      isRegistered,
      enabled: isOnline && !isRegistered,
    });

  // Check registration timing
  const now = Date.now() / 1000;
  const registrationStartAt = config?.registrationStartAt ?? 0;
  const registrationEndAt = config?.registrationEndAt ?? 0;
  const isRegistrationOpen =
    registrationStartAt > 0 &&
    registrationEndAt > registrationStartAt &&
    now >= registrationStartAt &&
    now < registrationEndAt;

  const handleRegister = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await register();
      if (registrationStage === "done") {
        onRegistrationComplete?.();
      }
    },
    [register, registrationStage, onRegistrationComplete],
  );

  // Already registered - show badge
  if (isRegistered || registrationStage === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brilliance/10 px-2 py-0.5 text-[9px] font-semibold text-brilliance border border-brilliance/30">
        <Check className="w-3 h-3" />
        Registered
      </span>
    );
  }

  // Not online - don't show anything
  if (!isOnline) {
    return null;
  }

  // Registration not open - show closed badge
  if (!isRegistrationOpen) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold/5 px-2 py-0.5 text-[9px] font-semibold text-gold/50 border border-gold/20">
        Registration Closed
      </span>
    );
  }

  // Not connected - show connect hint
  if (!address) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold/5 px-2 py-0.5 text-[9px] font-semibold text-gold/50 border border-gold/20">
        Connect to register
      </span>
    );
  }

  // Error state
  if (registrationStage === "error") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleRegister}
          className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger border border-danger/30 hover:bg-danger/20 transition-colors"
        >
          Retry
        </button>
        {error && <span className="text-[9px] text-danger/70 max-w-[120px] truncate">{error}</span>}
      </div>
    );
  }

  // Registering - show progress
  if (isRegistering) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-gold/10 px-2 py-1 text-[10px] font-semibold text-gold border border-gold/30">
        <Loader2 className="w-3 h-3 animate-spin" />
        {getStageLabel(registrationStage)}
      </span>
    );
  }

  // Ready to register - show button with fee info
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRegister}
        disabled={!canRegister}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
          canRegister
            ? "bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20"
            : "bg-gold/5 text-gold/40 border border-gold/20 cursor-not-allowed"
        }`}
      >
        <UserPlus className="w-3 h-3" />
        Register
      </button>
      {requiresEntryToken && feeAmount > 0n && (
        <span className="text-[9px] text-gold/50">Fee: {formatFeeAmount(feeAmount)} LORDS</span>
      )}
    </div>
  );
};
