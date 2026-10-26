import type { PlayerNames } from "@/hooks/use-player-profile";
import { historyStoryEvent, processStoryEvent, type ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { oneStoryPerAction } from "@/ui/features/event-feed/event-stories";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";

import recorded from "./recorded-feed.json";

/**
 * Prod's Frontier game 1 as perf pulled it (25 Oct 2026, 17:24Z, public data): the World feed's newest 350 stories, the
 * public names of the 8 players they name, and the facts their words read, as Herald rows (scripts/lab/record-feed.mjs).
 * The viewer is the owner's account, whose stories the feed draws in gold.
 */
export const RECORDED_FEED = recorded as unknown as {
  pulledAt: string;
  viewer: string;
  names: Record<string, string>;
  facts: { model: string; key: string; value: Record<string, unknown> }[];
  history: HeraldHistoryEvent[];
};

const FRONTIER_PRESET = 5;
const SCOPE = { chainId: "lab", worldAddress: "0x1ab", gameId: 1 };

/** The recorded game made the one this page plays: its facts in a store, its game the active one. */
export const installRecordedGame = (): NativeFactStore => {
  const store = new NativeFactStore();
  store.applyFacts(RECORDED_FEED.facts as never);
  configManager.setActiveGame(1, FRONTIER_PRESET);
  configManager.setStore(store);
  return store;
};

/** The recorded page as the World feed reads it: each history event a story, worded for the viewer, each action once. */
export const recordedStories = (store: NativeFactStore, names: PlayerNames): ProcessedStoryEvent[] =>
  oneStoryPerAction(
    RECORDED_FEED.history.flatMap((event) => {
      const story = historyStoryEvent(event, SCOPE);
      return story ? [processStoryEvent(story, store, RECORDED_FEED.viewer, names.text)] : [];
    }),
  );

/**
 * The identity service's answer for the recorded players, in the tab, so every name is read the one way a game reads
 * it (usePlayerNames). Returns what puts the network back; asked again while it stands, it returns the same.
 */
let restoreNetwork: (() => void) | null = null;

export const answerRecordedNames = (): (() => void) => {
  if (restoreNetwork) return restoreNetwork;
  const network = window.fetch;
  const known = new Map(Object.entries(RECORDED_FEED.names).map(([address, name]) => [BigInt(address), name]));
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.pathname !== "/api/profiles") return network(input, init);
    const accounts = url.searchParams.get("accounts")?.split(",") ?? [];
    const profiles = Object.fromEntries(
      accounts.flatMap((account) => {
        const name = known.get(BigInt(account));
        return name ? [[account, { name, portrait: null }]] : [];
      }),
    );
    return Promise.resolve(
      new Response(JSON.stringify({ profiles }), { status: 200, headers: { "content-type": "application/json" } }),
    );
  };
  restoreNetwork = () => {
    window.fetch = network;
    restoreNetwork = null;
  };
  return restoreNetwork;
};
