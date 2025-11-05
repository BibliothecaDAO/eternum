import type { ProviderHeartbeat, ProviderHeartbeatSource, ProviderSyncState } from "./types";

export interface ProviderDesyncStatus {
  isDesynced: boolean;
  elapsed: number | null;
  heartbeat: ProviderHeartbeat | null;
}

type HeartbeatPublishFn = (heartbeat: ProviderHeartbeat) => void;

export class ProviderHeartbeatManager {
  private lastTransactionSubmittedAt: number | null = null;
  private lastTransactionConfirmedAt: number | null = null;
  private lastStreamAt: number | null = null;
  private lastBlockNumber: number | null = null;
  private lastHeartbeat: ProviderHeartbeat | null = null;

  constructor(private readonly publish: HeartbeatPublishFn) {}

  public getSyncState(): ProviderSyncState {
    return {
      lastTransactionSubmittedAt: this.lastTransactionSubmittedAt,
      lastTransactionConfirmedAt: this.lastTransactionConfirmedAt,
      lastStreamAt: this.lastStreamAt,
      lastBlockNumber: this.lastBlockNumber,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  public getDesyncStatus(thresholdMs = 10_000): ProviderDesyncStatus {
    if (!this.lastHeartbeat) {
      return {
        isDesynced: true,
        elapsed: null,
        heartbeat: null,
      };
    }

    const elapsed = Date.now() - this.lastHeartbeat.timestamp;

    return {
      isDesynced: elapsed > thresholdMs,
      elapsed,
      heartbeat: this.lastHeartbeat,
    };
  }

  public simulateHeartbeat(
    options: {
      source?: ProviderHeartbeatSource;
      timestamp?: number;
      offsetMs?: number;
      blockNumber?: number;
      transactionHash?: string;
    } = {},
  ): ProviderHeartbeat {
    const now = Date.now();
    const timestamp = options.timestamp ?? now - (options.offsetMs ?? 0);
    const source: ProviderHeartbeatSource = options.source ?? "mock";
    const heartbeat: ProviderHeartbeat = {
      source,
      timestamp,
      blockNumber: options.blockNumber,
      transactionHash: options.transactionHash,
    };

    switch (source) {
      case "transaction-submitted":
        this.lastTransactionSubmittedAt = timestamp;
        break;
      case "transaction-confirmed":
        this.lastTransactionConfirmedAt = timestamp;
        break;
      case "stream":
        this.lastStreamAt = timestamp;
        break;
      case "mock":
      default:
        break;
    }

    if (heartbeat.blockNumber !== undefined && heartbeat.blockNumber !== null) {
      this.lastBlockNumber = heartbeat.blockNumber;
    }

    this.publishHeartbeat(heartbeat);
    return heartbeat;
  }

  public recordStreamActivity(meta?: { blockNumber?: number; timestamp?: number }) {
    const timestamp = meta?.timestamp ?? Date.now();
    this.lastStreamAt = timestamp;

    if (meta?.blockNumber !== undefined && meta?.blockNumber !== null) {
      this.lastBlockNumber = meta.blockNumber;
    }

    this.publishHeartbeat({
      source: "stream",
      timestamp,
      blockNumber: meta?.blockNumber,
    });
  }

  public recordTransactionSubmission() {
    const timestamp = Date.now();
    this.lastTransactionSubmittedAt = timestamp;
    this.publishHeartbeat({
      source: "transaction-submitted",
      timestamp,
      blockNumber: this.lastBlockNumber ?? undefined,
    });
  }

  public recordTransactionConfirmation({
    transactionHash,
    blockNumber,
  }: {
    transactionHash: string;
    blockNumber?: number | null;
  }) {
    const timestamp = Date.now();
    this.lastTransactionConfirmedAt = timestamp;

    if (blockNumber !== undefined && blockNumber !== null) {
      this.lastBlockNumber = blockNumber;
    }

    this.publishHeartbeat({
      source: "transaction-confirmed",
      timestamp,
      blockNumber: blockNumber ?? undefined,
      transactionHash,
    });
  }

  private publishHeartbeat(heartbeat: ProviderHeartbeat) {
    this.lastHeartbeat = heartbeat;
    this.publish(heartbeat);
  }
}
