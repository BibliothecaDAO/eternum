import type { HeraldGameDirectoryEntry, HeraldGameStatus } from "@bibliothecadao/eternum/game-sync";
import type { FoldRow } from "./types";
interface GameDirectorySource {
  modelRows: (model: string) => FoldRow[];
}

export interface DirectoryInput {
  chain: string;
  confirmedBlock: number;
  fold: GameDirectorySource;
  playerAddress?: string;
  timestamp: number;
}

/** Directory phases advance with the chain clock; settlement still requires a recorded transaction. */
export function resolveDirectoryStatus(
  recorded: HeraldGameStatus,
  clock: Pick<HeraldGameDirectoryEntry["clock"], "start_main_at" | "end_at">,
  devMode: boolean,
  timestamp: number,
): HeraldGameStatus {
  if (recorded === "Settled" || recorded === "Ended") return recorded;
  if (clock.end_at > 0 && timestamp >= clock.end_at) return "Ended";
  if (devMode || timestamp >= clock.start_main_at) return "Live";
  return recorded;
}
