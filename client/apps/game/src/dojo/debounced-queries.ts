import { Component, Metadata, Schema } from "@dojoengine/recs";
import { ToriiClient } from "@dojoengine/torii-client";
import debounce from "lodash/debounce";
import {
  addDonkeysAndArmiesSubscription,
  getEntitiesFromTorii,
  getMarketFromTorii,
  getOneKeyModelbyRealmEntityIdFromTorii,
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

export const debouncedGetOneKeyEntitiesByRealmEntityIdFromTorii = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: string[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(() => getOneKeyModelbyRealmEntityIdFromTorii(client, components, entityID), onComplete);
  },
  250,
  { leading: true },
);

export const debouncedGetDonkeysAndArmiesFromTorii = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: number[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(() => addDonkeysAndArmiesSubscription(client, components, entityID), onComplete);
  },
  250,
  { leading: true },
);

export const debouncedGetEntitiesFromTorii = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    entityID: string[],
    entityModels: string[],
    positions?: { x: number; y: number }[],
    onComplete?: () => void,
  ) => {
    await subscriptionQueue.add(
      () => getEntitiesFromTorii(client, components, entityID, entityModels, positions),
      onComplete,
    );
  },
  250,
  { leading: true },
);

export const debouncedGetMarketFromTorii = debounce(
  async <S extends Schema>(
    client: ToriiClient,
    components: Component<S, Metadata, undefined>[],
    onComplete?: () => void,
  ) => {
    await marketQueue.add(() => getMarketFromTorii(client, components), onComplete);
  },
  500,
  { leading: true },
);
