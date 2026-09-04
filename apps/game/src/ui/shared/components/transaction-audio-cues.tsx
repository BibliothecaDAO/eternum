import { classifyTransactionError } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { AudioManager } from "@/audio/core/AudioManager";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import { verboseLog } from "@/utils/dev-mode";

type TransactionFailurePayload = {
  message?: string;
  type?: string;
  failureKind?: string;
  error?: unknown;
};

/**
 * The sound of a transaction: pending, confirmed, failed. The rows themselves live in the transaction store (the
 * listener writes them) and the event feed shows them; this only plays the cue and logs the failure.
 */
export function TransactionAudioCues() {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  useEffect(() => {
    const handleTransactionPending = (receipt: unknown) => {
      verboseLog("Transaction pending:", receipt);
      AudioManager.getInstance().play("ui.toast_info");
    };

    const handleTransactionComplete = (receipt: unknown) => {
      verboseLog("Transaction completed:", receipt);
      AudioManager.getInstance().play("ui.tx_success");
    };

    const handleTransactionFailed = (payload: TransactionFailurePayload) => {
      if (payload.failureKind === "submission_timeout_no_hash") {
        AudioManager.getInstance().play("ui.tx_fail");
        return;
      }
      const classified = classifyTransactionError("error" in payload ? payload.error : payload.message);
      if (classified.kind === "user_cancelled") {
        verboseLog("Transaction cancelled by user:", payload.type);
        return;
      }
      console.error(
        `Transaction failed: ${formatReadableErrorForConsole(payload.error ?? payload.message, classified.reason ?? "Transaction failed.")}`,
      );
      AudioManager.getInstance().play("ui.tx_fail");
    };

    provider.on("transactionPending", handleTransactionPending);
    provider.on("transactionComplete", handleTransactionComplete);
    provider.on("transactionFailed", handleTransactionFailed);

    return () => {
      provider.off("transactionPending", handleTransactionPending);
      provider.off("transactionComplete", handleTransactionComplete);
      provider.off("transactionFailed", handleTransactionFailed);
    };
  }, [provider]);

  return null;
}
