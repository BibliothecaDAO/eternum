import type { FoldDelete, FoldRow, FoldSet } from "./types";

interface StreamMessageBase {
  epoch: string;
  seq: number;
}

export type HeraldStreamMessage =
  | (StreamMessageBase & {
      type: "hello";
      confirmed_block: number;
      preconfirmed_block: number | null;
    })
  | (StreamMessageBase & { type: "snapshot"; model: string; rows: FoldRow[] })
  | (StreamMessageBase & { type: "snapshot_end" })
  | (StreamMessageBase & {
      type: "diff";
      block: number | null;
      preconfirmed: boolean;
      set: FoldSet[];
      del: FoldDelete[];
    })
  | (StreamMessageBase & { type: "overlay_reset"; confirmed_block: number })
  | (StreamMessageBase & {
      type: "tx";
      hash: string;
      status: string;
      block: number | null;
      revert_reason?: string;
    })
  | (StreamMessageBase & { type: "head"; block: number; timestamp: number });

export interface ResumeRequest {
  type: "resume";
  epoch: string;
  seq: number;
}
