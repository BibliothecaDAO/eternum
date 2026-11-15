import { ASPECT_REWARD } from "@bibliothecadao/types";

/** Height pays a rate per point, and the Aspect that finished first adds the finish bonus: what the page shows, nothing is paid. */
export function lordsWorth(height: number, finishedFirst: boolean): number {
  return height * ASPECT_REWARD.lordsPerHeight + (finishedFirst ? ASPECT_REWARD.finishBonus : 0);
}
