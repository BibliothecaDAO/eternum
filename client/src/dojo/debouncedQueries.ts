import { Component, Metadata, Schema } from "@dojoengine/recs";
import { ToriiClient } from "@dojoengine/torii-client";
import debounce from "lodash/debounce";
import {
  addArrivalsSubscription,
  addMarketSubscription,
  addToSubscription,
  addToSubscriptionOneKeyModelbyRealmEntityId,
  addToSubscriptionTwoKeyModelbyRealmEntityId,
  syncPosition,
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

// Create separate queues for different types of requests
const positionQueue = new RequestQueue();
const subscriptionQueue = new RequestQueue();
const marketQueue = new RequestQueue();

// Debounced functions that add to queues
export const debouncedSyncPosition = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: string,
    onComplete?: () => void,
  ) => {
    await positionQueue.add(() => syncPosition(client, components, entityID), onComplete);
  },
  100,
  { leading: true }, // Add leading: true to execute immediately on first call
);

export const debouncedAddToSubscriptionTwoKey = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: string[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(
      () => addToSubscriptionTwoKeyModelbyRealmEntityId(client, components, entityID),
      onComplete,
    );
  },
  250,
  { leading: true },
);

export const debouncedAddToSubscriptionOneKey = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: string[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(
      () => addToSubscriptionOneKeyModelbyRealmEntityId(client, components, entityID),
      onComplete,
    );
  },
  250,
  { leading: true },
);

export const debounceAddResourceArrivals = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: number[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(() => addArrivalsSubscription(client, components, entityID), onComplete);
  },
  250,
  { leading: true },
);

export const debouncedAddToSubscription = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: string[],
    position?: { x: number; y: number }[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(() => addToSubscription(client, components, entityID, position), onComplete);
  },
  250,
  { leading: true },
);

export const debouncedAddMarketSubscription = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    onComplete?: () => void,
  ) => {
    await marketQueue.add(() => addMarketSubscription(client, components), onComplete);
  },
  500,
  { leading: true },
);

// Utility function to clear all queues if needed
export const clearAllQueues = () => {
  positionQueue.clear();
  subscriptionQueue.clear();
  marketQueue.clear();
};
