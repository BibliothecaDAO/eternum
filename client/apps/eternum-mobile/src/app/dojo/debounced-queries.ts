import { Component, Metadata, Schema } from "@dojoengine/recs";
import { ToriiClient } from "@dojoengine/torii-client";
import {
  addDonkeysAndArmiesSubscription,
  getEntitiesFromTorii,
  getMarketFromTorii,
  getQuestTilesFromTorii,
} from "./queries";

// Queue class to manage requests
class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private batchSize = 3; // Number of concurrent requests
  private batchDelayMs = 100; // Delay between batches

  async add(request: () => Promise<void>, onComplete?: () => void) {
    this.queue.push(async () => {
      await request();
      onComplete?.(); // Call onComplete after the request is processed
    });
    if (!this.processing) {
      this.processing = true;
      this.processQueue();
    }
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);

      try {
        await Promise.all(batch.map((request) => request()));
      } catch (error) {
        console.error("Error processing request batch:", error);
      }

      if (this.queue.length > 0) {
        // Add delay between batches to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, this.batchDelayMs));
      }
    }
    this.processing = false;
  }

  clear() {
    this.queue = [];
  }
}

const subscriptionQueue = new RequestQueue();
const marketQueue = new RequestQueue();

export const debouncedGetDonkeysAndArmiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: number[],
  onComplete?: () => void,
) => {
  await subscriptionQueue.add(() => addDonkeysAndArmiesSubscription(client, components, entityID), onComplete);
};

export const debouncedGetEntitiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  entityID: string[],
  entityModels: string[],
  positions?: { x: number; y: number }[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(
      () => getEntitiesFromTorii(client, components, entityID, entityModels, positions),
      onComplete,
    );
  } catch (error) {
    console.error("Error in debouncedGetEntitiesFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};

export const debouncedGetMarketFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  onComplete?: () => void,
) => {
  await marketQueue.add(() => getMarketFromTorii(client, components), onComplete);
};

export const debouncedGetQuestTilesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  questTileIds: number[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getQuestTilesFromTorii(client, components, questTileIds), onComplete);
  } catch (error) {
    console.error("Error in debouncedGetQuestTilesFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};
