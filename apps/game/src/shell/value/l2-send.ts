import { useState } from "react";

import { l2Provider } from "@/runtime/l2-rpc";

import { VALUE_WORDS } from "../words";

/**
 * Where a value screen's L2 send stands once the wallet has signed it: idle, confirming until its receipt lands, or
 * refused by the ledger with its reason. Every paid panel's send goes through useL2Send, so none can be tapped again
 * between the signature and the block, and none says "sent" for a send that reverted.
 */
type L2Send = { status: "idle" } | { status: "confirming" } | { status: "refused"; reason: string };

const IDLE: L2Send = { status: "idle" };

/**
 * One send's life after the signature: Confirming until its receipt, then `onLanded` reads the ledger again
 * (whatever the outcome); a revert keeps the ledger's own message for the panel.
 */
export const useL2Send = (onLanded: () => void) => {
  const [send, setSend] = useState<L2Send>(IDLE);
  const sent = (hash: string) => {
    setSend({ status: "confirming" });
    void l2Provider()
      .waitForTransaction(hash)
      .then(
        (receipt) => setSend(receipt.isReverted() ? { status: "refused", reason: refusalOf(receipt) } : IDLE),
        (error: unknown) => {
          console.error("l2_send_unconfirmed", { hash, error: error instanceof Error ? error.message : error });
          setSend({ status: "refused", reason: VALUE_WORDS.unconfirmed });
        },
      )
      .finally(onLanded);
  };
  return { send, sent };
};

/** The ledger's assertion inside a revert trace ("Ledger: roster full"), or the trace's first line. */
const refusalOf = (receipt: object): string => {
  const trace = "revert_reason" in receipt && typeof receipt.revert_reason === "string" ? receipt.revert_reason : "";
  return trace.match(/Ledger: [^'"\\\n]+/)?.[0] ?? (trace.split("\n")[0] || VALUE_WORDS.refused);
};
