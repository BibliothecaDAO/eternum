import { dir, soundSelector } from "@bibliothecadao/react";

export class HoverSound {
  private firstSound: HTMLAudioElement;
  private secondSound: HTMLAudioElement;
  private isFirst: boolean = true;

  constructor() {
    this.firstSound = new Audio(dir + soundSelector.shovelMain);
    this.secondSound = new Audio(dir + soundSelector.shovelAlternative);
  }

  public play(isSound: boolean, volume: number) {
    if (this.isFirst) {
      this.firstSound.volume = isSound ? volume / 100 : 0;
      this.firstSound.play();
    } else {
      this.secondSound.volume = isSound ? volume / 100 : 0;
      this.secondSound.play();
    }
    this.isFirst = !this.isFirst;
  }
}
