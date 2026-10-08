import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader";

import { BlitzListPage, BlitzLobbyPage } from "../blitz/blitz-pages";
import { LearnPage } from "../learn/learn-page";
import { DominionPage, EternumPage, FrontierPage } from "../play/age-pages";
import { PlayPage } from "../play/play-page";
import { PlayerPage, ProfilePage } from "../profile/profile-pages";
import { ResultsPage } from "../season-tab/results-page";
import { SeasonPage } from "../season-tab/season-page";
import {
  LAB_BLITZ_BOARD,
  LAB_CHAIN,
  LAB_FINISHED_BLITZ,
  LAB_FRONTIER_BOARD,
  LAB_GUARDIAN,
  LAB_PLAYER,
  LAB_PROFILES,
  LAB_RATING_TOP,
  LAB_SCREENS,
  LAB_SEAT_PROFILES,
  LAB_SESSION,
  LAB_CHAT,
  labRatings,
  labSlots,
  type LabScreen,
} from "./app-lab-fixtures";

/**
 * The dev build's app lab: the real pages over one fixture state per screen, for the painted pass's captures of states
 * the dev stack cannot hold (Day 12 of a season, a full lobby, a season just over). Opened as /lab/app/<screen>/<page>;
 * the lab answers the app's own /api reads and seeds the shard boards, so nothing leaves the tab.
 */
export const AppLabView = () => {
  const { screen } = useParams();
  if (!isLabScreen(screen)) return <Navigate to="/lab/app/home" replace />;
  return <LabScreenView key={screen} screen={screen} />;
};

const isLabScreen = (screen: string | undefined): screen is LabScreen =>
  screen !== undefined && Object.hasOwn(LAB_SCREENS, screen);

const LabScreenView = ({ screen }: { screen: LabScreen }) => {
  useBootDocumentState("app-ready");
  useFrontierType();
  const [client] = useState(() => createLabClient(screen));
  useLabSession(screen);
  return (
    <QueryClientProvider client={client}>
      <Routes>
        <Route index element={<PlayPage />} />
        <Route path="frontier" element={<FrontierPage />} />
        <Route path="eternum" element={<EternumPage />} />
        <Route path="dominion" element={<DominionPage />} />
        <Route path="blitz" element={<BlitzListPage />} />
        <Route path="blitz/:id" element={<BlitzLobbyPage />} />
        <Route path="season" element={<SeasonPage />} />
        <Route path="results/:id" element={<ResultsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="p/:address" element={<PlayerPage />} />
        <Route path="learn" element={<LearnPage />} />
      </Routes>
    </QueryClientProvider>
  );
};

/**
 * The screen's player: applied after the pages mount, so the real session read they start is outdated before it
 * answers and never lands.
 */
const useLabSession = (screen: LabScreen) => {
  useEffect(() => {
    useIdentitySessionStore.getState().applySession(LAB_SCREENS[screen].signedIn ? LAB_SESSION : null);
  }, [screen]);
};

/** The lab's own query client: the app's /api answered from the fixtures, the shard boards seeded by game. */
const createLabClient = (screen: LabScreen) => {
  answerAppReads(screen);
  answerLobbyChat();
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const gameId of [1, 3]) client.setQueryData(["shell", "leaderboard", LAB_CHAIN, gameId], LAB_FRONTIER_BOARD);
  client.setQueryData(["shell", "leaderboard", LAB_CHAIN, 7], LAB_BLITZ_BOARD);
  return client;
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** The /api reads the shell's pages make, by path; anything else goes to the network as before. */
const answerAppReads = (screen: LabScreen) => {
  const network = window.fetch.bind(window);
  const answers: Record<string, (url: URL) => Response> = {
    "/api/directory": () =>
      json({
        shards: [
          { url: "https://lab.invalid", chainId: LAB_CHAIN, status: "active", games: LAB_SCREENS[screen].games },
        ],
      }),
    "/api/directory/history": () => json({ games: [LAB_FINISHED_BLITZ], next: null, failures: [] }),
    "/api/guardian": () => json(LAB_GUARDIAN),
    "/api/slots": () => json(labSlots(LAB_SCREENS[screen].joined)),
    "/api/profiles": (url) => json({ profiles: profilesOf(url.searchParams.get("accounts")?.split(",") ?? []) }),
    "/api/ratings/top": () => json(LAB_RATING_TOP),
    "/api/ratings": (url) => json(labRatings(url.searchParams.get("accounts")?.split(",") ?? [])),
    "/api/chat/world": () => json({ messages: LAB_CHAT, nextCursor: null }),
  };
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    const answer = answers[url.pathname];
    return answer ? Promise.resolve(answer(url)) : network(input, init);
  };
};

/**
 * The lobby chat's room socket, answered in the tab: it admits the reader and echoes what a seated player sends as the
 * room would broadcast it. Any other socket opens as before.
 */
const answerLobbyChat = () => {
  const Network = window.WebSocket;
  class LabRoom extends EventTarget {
    readyState = 1;
    constructor() {
      super();
      setTimeout(() => this.#emit({ type: "joined:zone", zoneId: "slot:blitz-1630", canWrite: true }), 50);
    }
    send(data: string) {
      const sent = JSON.parse(data) as { payload: { content: string }; clientMessageId?: string };
      const message = {
        id: sent.clientMessageId ?? String(Date.now()),
        sender: { playerId: LAB_SESSION.user.realmsId, displayName: LAB_SESSION.user.name },
        zoneId: "slot:blitz-1630",
        content: sent.payload.content,
        createdAt: new Date().toISOString(),
      };
      this.#emit({ type: "world:message", zoneId: "slot:blitz-1630", message });
    }
    close() {
      this.readyState = 3;
    }
    #emit(body: unknown) {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(body) }));
    }
  }
  window.WebSocket = function (url: string | URL) {
    return String(url).includes("/api/chat/rooms/") ? new LabRoom() : new Network(url);
  } as unknown as typeof WebSocket;
};

const profilesOf = (accounts: readonly string[]) =>
  Object.fromEntries(
    accounts.flatMap((account) => {
      const profile =
        BigInt(account) === BigInt(LAB_PLAYER)
          ? { name: LAB_SESSION.user.name, portrait: LAB_SESSION.user.image }
          : (LAB_PROFILES[account] ?? LAB_SEAT_PROFILES[account]);
      return profile ? [[account, profile]] : [];
    }),
  );
