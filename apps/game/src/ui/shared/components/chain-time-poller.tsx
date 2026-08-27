import { setBlockTimestampSource, setChainTimestampEvidenceSink } from "@bibliothecadao/eternum";
import { useEffect } from "react";

import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { CHAIN_TIME_DEBUG_STORAGE_KEY, logChainTimeDebug } from "@/utils/chain-time-debug";

// Row-evidence heartbeats: a chain-written timestamp ahead of the clock proves
// chain time has reached that moment (see reportObservedChainTimestamp). The
// flush is deferred because evidence surfaces inside balance reads during React
// renders, and applied through setHeartbeat, which already ratchets
// monotonically and caps forward lead. Timestamps past any plausible clock
// drift are bad data, not evidence.
const MAX_EVIDENCE_FUTURE_MS = 10 * 60 * 1000;
let pendingEvidenceTimestampMs = 0;
let evidenceFlushScheduled = false;

const bindRowEvidenceSink = () => {
  setChainTimestampEvidenceSink((timestampSeconds) => {
    const timestampMs = timestampSeconds * 1000;
    if (timestampMs > Date.now() + MAX_EVIDENCE_FUTURE_MS) return;
    pendingEvidenceTimestampMs = Math.max(pendingEvidenceTimestampMs, timestampMs);
    if (evidenceFlushScheduled) return;
    evidenceFlushScheduled = true;
    window.setTimeout(() => {
      evidenceFlushScheduled = false;
      const timestamp = pendingEvidenceTimestampMs;
      pendingEvidenceTimestampMs = 0;
      useChainTimeStore.getState().setHeartbeat({ timestamp, source: "row-evidence" });
    }, 0);
  });
};

export const ChainTimePoller = () => {
  useEffect(() => {
    setBlockTimestampSource(() => useChainTimeStore.getState().getNowSeconds());
    bindRowEvidenceSink();
    logChainTimeDebug("source_bound", {
      source: "herald head + row-evidence sink",
      debugStorageKey: CHAIN_TIME_DEBUG_STORAGE_KEY,
    });

    return () => {
      setBlockTimestampSource(null);
      setChainTimestampEvidenceSink(null);
    };
  }, []);

  return null;
};
