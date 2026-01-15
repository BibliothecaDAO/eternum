import { AudioManager } from "@/audio/core/AudioManager";

export class HoverSound {
  private isFirst: boolean = true;

  constructor() {
    // No need to preload since AudioManager handles this
  }

  /**
   * Play hover sound. AudioManager handles muted state internally.
   */
  public play() {
    // Use the ui.shovel sound which has variations that will alternate
    // AudioManager handles muted state and category volumes internally
    AudioManager.getInstance().play("ui.shovel");
    this.isFirst = !this.isFirst;
  }
}
