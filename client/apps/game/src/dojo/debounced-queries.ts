import { HexPosition, ID } from "@bibliothecadao/types";
import { ToriiClient } from "@dojoengine/torii-client";
import { getBuildingsFromTorii, getEntitiesFromTorii, getOwnedArmiesFromTorii } from "./queries";

// Queue class to manage requests
type QueuedRequest = {
  request: () => Promise<void>;
  onComplete?: () => void;
  resolve: () => void;
  reject: (error: unknown) => void;
};

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private batchSize = 3; // Number of concurrent requests
  private batchDelayMs = 100; // Delay between batches

  async add(request: () => Promise<void>, onComplete?: () => void) {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        request,
        onComplete,
        resolve,
        reject,
      });

      if (!this.processing) {
        this.processing = true;
        void this.processQueue();
      }
    });
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);

      await Promise.all(batch.map((request) => this.processRequest(request)));

      if (this.queue.length > 0) {
        // Add delay between batches to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, this.batchDelayMs));
      }
    }
    this.processing = false;
  }

  private async processRequest(queuedRequest: QueuedRequest) {
    try {
      await queuedRequest.request();
      queuedRequest.onComplete?.();
      queuedRequest.resolve();
    } catch (error) {
      console.error("Error processing queued request:", error);
      queuedRequest.reject(error);
    }
  }

  clear() {
    const queuedRequests = this.queue.splice(0);
    queuedRequests.forEach((queuedRequest) => {
      queuedRequest.onComplete?.();
      queuedRequest.resolve();
    });
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

export const debouncedGetOwnedArmiesFromTorii = async (
  client: ToriiClient,
  owners: number[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getOwnedArmiesFromTorii(client, owners), onComplete);
  } catch (error) {
    console.error("Error in debouncedGetOwnedEntitiesFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};

export const debouncedGetEntitiesFromTorii = async (
  client: ToriiClient,
  entityIDs: ID[],
  entityModels: string[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getEntitiesFromTorii(client, entityIDs, entityModels), onComplete);
  } catch (error) {
    console.error("Error in debouncedGetEntitiesFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};

export const debouncedGetBuildingsFromTorii = async (
  client: ToriiClient,
  structurePositions: HexPosition[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getBuildingsFromTorii(client, structurePositions), onComplete);
  } catch (error) {
    console.error("Error in debouncedGetBuildingsFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};
