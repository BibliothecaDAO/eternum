import { HexPosition, ID } from "@bibliothecadao/types";
import { Component, Metadata, Schema } from "@dojoengine/recs";
import { ToriiClient } from "@dojoengine/torii-client";
import {
  getBuildingsFromTorii,
  getEntitiesFromTorii,
  getOwnedArmiesFromTorii,
  getQuestsFromTorii,
  getTilesForPositionsFromTorii,
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

export const debouncedGetOwnedArmiesFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  owners: number[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getOwnedArmiesFromTorii(client, components, owners), onComplete);
  } catch (error) {
    console.error("Error in debouncedGetOwnedEntitiesFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
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
    console.error("Error in debouncedGetEntitiesFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
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
    console.error("Error in debouncedGetBuildingsFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};

export const debouncedGetQuestsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  gameAddress: string,
  questGames: any[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(() => getQuestsFromTorii(client, components, gameAddress, questGames), onComplete);
  } catch (error) {
    console.error("Error in debouncedGetQuestsFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};

export const debouncedGetTilesForPositionsFromTorii = async <S extends Schema>(
  client: ToriiClient,
  components: Component<S, Metadata, undefined>[],
  positions: HexPosition[],
  onComplete?: () => void,
) => {
  try {
    await subscriptionQueue.add(async () => {
      await getTilesForPositionsFromTorii(client, components, positions);
      return;
    }, onComplete);
  } catch (error) {
    console.error("Error in debouncedGetTilesForPositionsFromTorii:", error);
    // Make sure onComplete is called even if there's an error
    onComplete?.();
  }
};
