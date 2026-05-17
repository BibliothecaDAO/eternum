import { HexPosition, ID } from "@bibliothecadao/types";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { ToriiClient } from "@dojoengine/torii-client";
import {
  getBuildingsFromTorii,
  getEntitiesFromTorii,
  getOwnedArmiesFromTorii,
  getTilesForPositionsFromTorii,
} from "./queries";

type QueuedRequest = {
  cancel: () => void;
  run: () => Promise<void>;
};

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private batchSize = 3; // Number of concurrent requests
  private batchDelayMs = 100; // Delay between batches

  add(request: () => Promise<void>, onComplete?: () => void): Promise<void> {
    const queuedRequest = new Promise<void>((resolve, reject) => {
      this.queue.push({
        cancel: () => {
          onComplete?.();
          resolve();
        },
        run: async () => {
          try {
            await request();
            onComplete?.(); // Call onComplete after the request is processed
            resolve();
          } catch (error) {
            reject(error);
            throw error;
          }
        },
      });
    });

    if (!this.processing) {
      this.processing = true;
      void this.processQueue();
    }

    return queuedRequest;
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);

      const results = await Promise.allSettled(batch.map((request) => request.run()));
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Error processing request batch:", result.reason);
        }
      }

      if (this.queue.length > 0) {
        // Add delay between batches to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, this.batchDelayMs));
      }
    }
    this.processing = false;
  }

  clear() {
    this.queue.forEach((request) => request.cancel());
    this.queue = [];
  }
}

const subscriptionQueue = new RequestQueue();

/**
 * Clear all pending queued requests.
 * Called during game/world switching to prevent in-flight requests
 * from the old world writing stale data into RECS.
 */
export const clearSubscriptionQueue = () => {
  subscriptionQueue.clear();
};

export const debouncedGetOwnedArmiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  owners: number[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getOwnedArmiesFromTorii(client, components, owners), onComplete);
  } catch (error) {
    onComplete?.();
    console.error("Error in debouncedGetOwnedEntitiesFromTorii:", error);
  }
};

export const debouncedGetEntitiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityIDs: ID[],
  entityModels: string[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getEntitiesFromTorii(client, components, entityIDs, entityModels), onComplete);
  } catch (error) {
    onComplete?.();
    console.error("Error in debouncedGetEntitiesFromTorii:", error);
  }
};

export const debouncedGetBuildingsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  structurePositions: HexPosition[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getBuildingsFromTorii(client, components, structurePositions), onComplete);
  } catch (error) {
    onComplete?.();
    console.error("Error in debouncedGetBuildingsFromTorii:", error);
  }
};
