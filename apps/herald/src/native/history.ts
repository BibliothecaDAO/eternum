import { storyParticipants } from "@bibliothecadao/eternum/game-client";
import type { NativeSchema } from "./schema";
import type { HistoryCodec } from "../history-store";

export function createNativeHistoryCodec(schema: NativeSchema): HistoryCodec {
  return {
    storyModels: schema.events.map(({ name }) => name),
    participants: storyParticipants,
  };
}
