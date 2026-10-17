import { uniform } from "three/tsl";
import { GameEndTimeline } from "./sequence";
import { resetEndgameField, endgameClock, endgameSettle } from "./field";

let timeline = new GameEndTimeline();
export const mapAnimationTime = uniform(0);
mapAnimationTime.onFrameUpdate((frame) => {
  if (!timeline.frame.finished) mapAnimationTime.value = frame.time;
  return mapAnimationTime.value;
});

export function advanceGameEnd(gameId: number, ended: boolean, deltaSeconds: number) {
  const frame = timeline.observe(gameId, ended, deltaSeconds);
  if (frame.phase === "live") resetEndgameField();
  endgameClock.value = frame.seconds;
  endgameSettle.value = frame.settle;
  return frame;
}
export const skipGameEnd = () => timeline.skip();
export function resetGameEnd(): void {
  timeline = new GameEndTimeline();
  resetEndgameField();
}
