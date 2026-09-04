import { z } from "zod";

type ChannelKind = "game" | "dm";

interface Channel {
  kind: ChannelKind;
  entityRef: string;
  id: string;
}

const gameChannelSchema = z.string().regex(/^game:[1-9][0-9]*$/, "Expected a game:<positive-id> channel.");

export const parseGameChannel = (value: unknown): Channel | null => {
  const result = gameChannelSchema.safeParse(value);
  if (!result.success) return null;
  return { kind: "game", entityRef: result.data.slice("game:".length), id: result.data };
};

export const gameChannelId = (gameId: number): string => `game:${gameId}`;
