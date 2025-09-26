import { type StoryEventSystemUpdate } from "../systems/types";

export type StoryEventListener = (event: StoryEventSystemUpdate) => void;

class StoryEventBus {
  private listeners: Set<StoryEventListener> = new Set();

  subscribe(listener: StoryEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: StoryEventSystemUpdate) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const storyEventBus = new StoryEventBus();
