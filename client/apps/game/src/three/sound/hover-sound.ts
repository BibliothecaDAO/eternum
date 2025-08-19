import { AudioManager } from "@/audio/core/AudioManager";

export class HoverSound {
  private isFirst: boolean = true;

  constructor() {
    // No need to preload since AudioManager handles this
  }

  public play(isSound: boolean, volume: number) {
    if (!isSound) return;
    
    // Use the ui.shovel sound which has variations that will alternate
    AudioManager.getInstance().play('ui.shovel', { volume: volume / 100 });
    this.isFirst = !this.isFirst;
  }
}
