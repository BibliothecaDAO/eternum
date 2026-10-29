import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { IdentityRequestError } from "@realms-world/identity";

import { BlitzLobbyPage } from "../blitz/blitz-pages";
import { BuildOrdersPage } from "../build-orders/build-orders-page";
import { entryTermsKey, refundOwedKey, registeredSlotsKey, slotRegisteredKey } from "../blitz/entry";
import { seasonPrizeKey } from "../season-tab/blitz-season";
import { rewardKey } from "../season-tab/reward";
import { PageAddress } from "../frame/page-address";
import { CreditsPage, PrivacyPage, TermsPage } from "../legal";
import { WhatsNewPage } from "../news/news";
import { NotFoundPage } from "../not-found";
import { PlayPage } from "../play/play-page";
import { PlayerPage, ProfilePage, SettingsPage } from "../profile/profile-pages";
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
  LAB_GLOBAL_CHAT,
  LAB_EMAIL_CODE,
  LAB_ENTRY_TERMS,
  LAB_GAME_KEYS,
  LAB_NAMES,
  LAB_REWARDS,
  LAB_SEASON_PRIZES,
  LAB_PAYOUT_WALLETS,
  LAB_SLOT_KEY,
  LAB_SLOT_REGISTERED,
  LAB_WALLET,
  labRatings,
  labCalendar,
  labSlots,
  type LabScreen,
} from "./app-lab-fixtures";
import { LabConnect, LabDoorway } from "./app-lab-flows";
import { answerLabChat } from "./lab-chat";
import { AppChatConnection } from "../chat/app-chat";
import { ChatPage } from "../chat/chat-page";

/**
 * The dev build's app lab: the real pages over one fixture state per screen, for the painted pass's captures of states
 * the dev stack cannot hold (Day 12 of a season, a full lobby, a season just over). Opened as /lab/app/<screen>/<page>;
 * the lab answers the app's own /api reads and seeds the shard boards, so nothing leaves the tab. Beside the pages:
 * Connect's steps, the doorway's holds (app-lab-flows.tsx), the reading pages and an unknown path's.
 */
export const AppLabView = () => {
  const { screen } = useParams();
  if (!isLabScreen(screen)) return <Navigate to="/lab/app/home" replace />;
  return <LabScreenView key={screen} screen={screen} />;
};

const isLabScreen = (screen: string | undefined): screen is LabScreen =>
  screen !== undefined && Object.hasOwn(LAB_SCREENS, screen);

const LabScreenView = ({ screen }: { screen: LabScreen }) => {
  const [client, setClient] = useState<QueryClient | null>(null);
  useEffect(() => {
    const restore = installLabFixtures(screen);
    const client = createLabClient(screen);
    setClient(client);
    return () => {
      client.clear();
      restore();
    };
  }, [screen]);
  if (!client) return <p role="status">Loading app fixtures…</p>;
  return (
    <QueryClientProvider client={client}>
      <LabPages screen={screen} />
      {/* The app shell's one chat connection, for a signed-in screen, over the lab's answered sockets. */}
      {LAB_SCREENS[screen].signedIn && <AppChatConnection />}
    </QueryClientProvider>
  );
};

/** The real pages at their addresses under the screen's, each told its own so the places light it. */
const LabPages = ({ screen }: { screen: LabScreen }) => {
  useLabSession(screen);
  const { "*": page = "" } = useParams();
  return (
    <PageAddress.Provider value={`/${page}`}>
      <Routes>
        <Route index element={<PlayPage />} />
        <Route path="blitz/build-orders" element={<BuildOrdersPage />} />
        <Route path="blitz/:id" element={<BlitzLobbyPage />} />
        <Route path="season" element={<SeasonPage />} />
        <Route path="results/:id" element={<ResultsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/settings" element={<SettingsPage />} />
        <Route path="p/:address" element={<PlayerPage />} />
        <Route path="scroll" element={<WhatsNewPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="connect/:step" element={<LabConnect />} />
        <Route path="doorway/:state" element={<LabDoorway />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PageAddress.Provider>
  );
};

/**
 * The screen's player: applied after the pages mount, so the real session read they start is outdated before it
 * answers and never lands.
 */
const useLabSession = (screen: LabScreen) => {
  useEffect(() => {
    const user = {
      ...LAB_SESSION.user,
      name: LAB_NAMES[screen] ?? LAB_SESSION.user.name,
      address: LAB_PAYOUT_WALLETS[screen] ?? null,
    };
    const session = { ...LAB_SESSION, user };
    useIdentitySessionStore.getState().applySession(LAB_SCREENS[screen].signedIn ? session : null);
  }, [screen]);
};

/** The lab's own query client: the app's /api answered from the fixtures, the shard boards seeded by game. */
const createLabClient = (screen: LabScreen) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const gameId of [1, 3]) client.setQueryData(["shell", "leaderboard", LAB_CHAIN, gameId], LAB_FRONTIER_BOARD);
  client.setQueryData(["shell", "leaderboard", LAB_CHAIN, 7], LAB_BLITZ_BOARD);
  const wallet = LAB_PAYOUT_WALLETS[screen];
  const terms = LAB_ENTRY_TERMS[screen];
  if (terms && wallet) client.setQueryData(entryTermsKey(LAB_SLOT_KEY, wallet), terms);
  client.setQueryData(slotRegisteredKey(LAB_SLOT_KEY), LAB_SLOT_REGISTERED);
  // The list's refund row: the closed slot owes the wallet on the screen that left it unseated.
  if (wallet) {
    client.setQueryData(registeredSlotsKey(wallet), [LAB_SLOT_KEY]);
    client.setQueryData(refundOwedKey(LAB_SLOT_KEY, wallet), screen === "entry-unseated");
  }
  const reward = LAB_REWARDS[screen];
  const prize = LAB_SEASON_PRIZES[screen];
  if (reward) client.setQueryData(rewardKey(LAB_GAME_KEYS, LAB_WALLET), reward);
  if (prize) client.setQueryData(seasonPrizeKey([{ slot: LAB_SLOT_KEY, wallet: LAB_WALLET }]), prize);
  return client;
};

function installLabFixtures(screen: LabScreen): () => void {
  const previousFetch = window.fetch;
  const previousWebSocket = window.WebSocket;
  const previousSession = useIdentitySessionStore.getState().session;
  const identityMethods = [
    "listSignInProviders",
    "availableSignInProviders",
    "sendSignInCode",
    "unlinkWallet",
    "linkWallet",
    "getBuildOrders",
    "saveBuildOrders",
  ];
  const descriptors = identityMethods.map(
    (name) => [name, Object.getOwnPropertyDescriptor(identityClient, name)] as const,
  );
  answerAppReads(screen);
  answerChat(screen);
  answerIdentity();
  return () => {
    window.fetch = previousFetch;
    window.WebSocket = previousWebSocket;
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(identityClient, name, descriptor);
      else Reflect.deleteProperty(identityClient, name);
    }
    useIdentitySessionStore.getState().applySession(previousSession);
  };
}

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
    "/api/directory/history": () =>
      json({
        games: screen === "no-games" || screen === "no-blitz" || screen === "blitz-next" ? [] : [LAB_FINISHED_BLITZ],
        next: null,
        failures: [],
      }),
    "/api/guardian": () => json(LAB_GUARDIAN),
    "/api/slots": () => json(labSlots(screen)),
    "/api/factory/calendar": () => json(labCalendar(screen)),
    "/api/profiles": (url) => json({ profiles: profilesOf(url.searchParams.get("accounts")?.split(",") ?? []) }),
    "/api/ratings/top": () => json(LAB_RATING_TOP),
    "/api/ratings": (url) => json(labRatings(url.searchParams.get("players")?.split(",") ?? [])),
  };
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    const answer = answers[url.pathname];
    return answer ? Promise.resolve(answer(url)) : network(input, init);
  };
};

/**
 * The identity service's answers for the account page: a code is always sent, and a wallet change spends the lab's
 * one code and refuses any other, as the service refuses it. The client holds its own fetch, so its calls are answered
 * on the client itself.
 */
const answerIdentity = () => {
  identityClient.listSignInProviders = async () => ["discord"];
  identityClient.availableSignInProviders = async () => ["discord"];
  identityClient.sendSignInCode = async () => ({ success: true, expires_at: Date.now() + 300_000 });
  const spend = async (code: unknown) => {
    if (code !== LAB_EMAIL_CODE) throw new IdentityRequestError(400, "INVALID_OTP");
  };
  // The account's build orders, kept in the tab: each save is held, and read back, at the next revision.
  let orders = { revision: 3, book: LAB_BUILD_ORDERS as unknown };
  const buildOrders = () => ({ owner: useIdentitySessionStore.getState().session?.user.realmsId ?? "", ...orders });
  Object.assign(identityClient, {
    getBuildOrders: async () => buildOrders(),
    saveBuildOrders: async ({ book }: { book: unknown }) => {
      orders = { revision: orders.revision + 1, book };
      return buildOrders();
    },
    unlinkWallet: spend,
    linkWallet: async ({ code }: { code?: string }) => spend(code).then(() => LAB_PLAYER),
  });
};

/** The chat's rooms, answered in the tab: Global writes, and a lobby's room for a wallet registered in its slot, not refunded. */
const answerChat = (screen: LabScreen) => {
  const registration = LAB_ENTRY_TERMS[screen]?.registration;
  const canWrite =
    LAB_ENTRY_TERMS[screen]?.cancelled !== true &&
    registration?.registered === true &&
    registration.paid > 0n &&
    !registration.refundable;
  // A lobby's room has its lobby's lines, Global its own.
  answerLabChat({
    lobbyWrites: canWrite,
    history: (zoneId) => (zoneId.startsWith("slot:") ? LAB_CHAT : LAB_GLOBAL_CHAT),
  });
};

/** Three orders a player saved, Coal rush the one followed. */
const LAB_BUILD_ORDERS = {
  active: "coal-rush",
  orders: [
    {
      id: "coal-rush",
      order: {
        name: "Coal rush",
        steps: [
          { rank: "Settlement", goal: "farm", count: 2 },
          { rank: "Settlement", goal: "levelUp" },
          { rank: "City", goal: "coal", count: 2 },
          { rank: "City", goal: "copper", count: 2 },
          { rank: "City", goal: "barracks", count: 1 },
          { rank: "City", goal: "levelUp" },
          { rank: "Kingdom", goal: "army", count: 1 },
          { rank: "Kingdom", goal: "farm", count: 4 },
          { rank: "Empire", goal: "army", count: 3 },
        ],
      },
    },
    {
      id: "wood-first",
      order: {
        name: "Wood first",
        steps: [
          { rank: "Settlement", goal: "wood", count: 2 },
          { rank: "City", goal: "farm", count: 4 },
        ],
      },
    },
    {
      id: "early-army",
      order: {
        name: "Early army",
        steps: [
          { rank: "Settlement", goal: "barracks", count: 1 },
          { rank: "Settlement", goal: "army", count: 1 },
        ],
      },
    },
  ],
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
