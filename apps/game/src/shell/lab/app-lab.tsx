import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { IdentityRequestError, SOCIAL_PROVIDERS, type SealCodeRefusal } from "@realms-world/identity";
import { answerLabBuildOrders } from "./lab-build-orders";

import { BuildOrdersPage } from "../build-orders/build-orders-page";
import { PageAddress } from "../frame/page-address";
import { CreditsPage, PrivacyPage, TermsPage } from "../legal";
import { WhatsNewPage } from "../news/news";
import { NotFoundPage } from "../not-found";
import { PlayPage } from "../play/play-page";
import { SharedLinkPage } from "../share/shared-link-page";
import { FragmentsPage } from "../shop/fragments-page";
import { answerAvnuRead, answerTokenBalances, isAvnuRead } from "./lab-pay-tokens";
import { PlayerPage, ProfilePage, SettingsPage } from "../profile/profile-pages";
import { ResultsPage } from "../season-tab/results-page";
import { SeasonPage } from "../season-tab/season-page";
import {
  LAB_CHAIN,
  LAB_FINISHED_BLITZ,
  LAB_FRONTIER_BOARD,
  LAB_FIELD_MIN,
  LAB_FINAL_BOARDS,
  LAB_FRONTIER_FINAL_BOARD,
  LAB_FRONTIER_UNPUBLISHED_BOARD,
  LAB_NO_SHARES,
  LAB_SHARE_TALLIES,
  LAB_GUARDIAN,
  LAB_HELD_REALMS,
  LAB_PLAYER,
  LAB_PROFILES,
  LAB_CHAT_PROFILES,
  LAB_SHARD_MANIFEST,
  labFrontierBoard,
  LAB_NO_HISTORY_SCREENS,
  LAB_SCREENS,
  LAB_SESSION,
  LAB_GLOBAL_CHAT,
  LAB_EMAIL_CODE,
  LAB_NAMES,
  LAB_PAYOUT_WALLETS,
  labRatings,
  labCalendar,
  labOrderIntent,
  LAB_INVITE,
  labJoinedShare,
  labSealCode,
  LAB_FRAGMENT_QUOTE,
  LAB_SEAL_CODE,
  LAB_SHARE_CODE,
  type LabScreen,
} from "./app-lab-fixtures";
import { LabConnect, LabDoorway } from "./app-lab-flows";
import { answerLabChat } from "./lab-chat";
import { AppChatConnection } from "../chat/app-chat";
import { ChatPage } from "../chat/chat-page";

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
    const field = labField();
    const restore = installLabFixtures(screen, field);
    const client = createLabClient(screen, field);
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
        <Route path="s/:code" element={<SharedLinkPage />} />
        <Route path="shop/fragments" element={<FragmentsPage />} />
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
      name: labPlayerName(screen),
      address: LAB_PAYOUT_WALLETS[screen] ?? null,
    };
    const session = { ...LAB_SESSION, user };
    useIdentitySessionStore.getState().applySession(LAB_SCREENS[screen].signedIn ? session : null);
  }, [screen]);
};

const labField = (): number | null => {
  const field = Number(new URLSearchParams(window.location.search).get("field"));
  return Number.isSafeInteger(field) && field >= LAB_FIELD_MIN ? field : null;
};

/**
 * The lab's own query client: the app's /api answered from the fixtures, the shard boards seeded by game (Frontier's
 * read from Herald's route instead when the lab holds a field).
 */
const createLabClient = (screen: LabScreen, field: number | null) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (field === null)
    client.setQueryData(
      ["shell", "leaderboard", LAB_CHAIN, 1],
      screen === "season-unpublished" ? LAB_FRONTIER_UNPUBLISHED_BOARD : LAB_FRONTIER_BOARD,
    );
  client.setQueryData(["shell", "leaderboard", LAB_CHAIN, 3], LAB_FINAL_BOARDS[screen] ?? LAB_FRONTIER_FINAL_BOARD);
  return client;
};

function installLabFixtures(screen: LabScreen, field: number | null): () => void {
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
    "shareTally",
    "readDefaultWallet",
    "deleteAccount",
    "priceFragments",
    "payFragments",
    "fragmentPayment",
  ];
  const descriptors = identityMethods.map(
    (name) => [name, Object.getOwnPropertyDescriptor(identityClient, name)] as const,
  );
  answerAppReads(screen, field);
  answerLabChat({ history: () => LAB_GLOBAL_CHAT });
  answerIdentity(screen);
  const restoreBalances = answerTokenBalances();
  return () => {
    restoreBalances();
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

/**
 * The /api reads the shell's pages make, by path; anything else goes to the network as before. With a field, the
 * shard is listed with its manifest and its Frontier board answered at Herald's path, a site on for the player at each
 * read.
 */
const answerAppReads = (screen: LabScreen, field: number | null) => {
  const network = window.fetch.bind(window);
  let boardReads = 0;
  const shard = { url: "https://lab.invalid", chainId: LAB_CHAIN, games: LAB_SCREENS[screen].games };
  const answers: Record<string, (url: URL) => Response> = {
    "/api/directory": () => json({ shard: field === null ? shard : { ...shard, manifest: LAB_SHARD_MANIFEST } }),
    // The player's own finished Blitz.
    "/api/directory/history": () =>
      json({
        games: LAB_NO_HISTORY_SCREENS.includes(screen) ? [] : [LAB_FINISHED_BLITZ],
        next: null,
        failures: [],
      }),
    "/api/guardian": () => json(LAB_GUARDIAN),
    "/api/factory/calendar": () => json(labCalendar(screen)),
    "/api/profiles": (url) =>
      json({ profiles: profilesOf(screen, url.searchParams.get("accounts")?.split(",") ?? []) }),
    "/api/ratings": (url) => json(labRatings(url.searchParams.get("players")?.split(",") ?? [])),
    "/api/value/held-realms": () => {
      const held = LAB_HELD_REALMS[screen] ?? [];
      return json({ realms: held.map(({ realmId }) => realmId), held });
    },
  };
  if (field !== null) answers["/games/1/leaderboard"] = () => json(labFrontierBoard(field, boardReads++));
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (isAvnuRead(url)) return Promise.resolve(answerAvnuRead(url, init?.body?.toString()));
    const answer = answers[url.pathname];
    return answer ? Promise.resolve(answer(url)) : network(input, init);
  };
};

const answerIdentity = (screen: LabScreen) => {
  identityClient.listSignInProviders = async () => ["discord"];
  identityClient.availableSignInProviders = async () => [...SOCIAL_PROVIDERS];
  identityClient.sendSignInCode = async () => ({ success: true, expires_at: Date.now() + 300_000 });
  const spend = async (code: unknown) => {
    if (code !== LAB_EMAIL_CODE) throw new IdentityRequestError(400, "INVALID_OTP");
  };
  identityClient.shareTally = async () => LAB_SHARE_TALLIES[screen] ?? LAB_NO_SHARES;
  let intent = labOrderIntent(screen);
  identityClient.getOrderIntent = async () => intent;
  identityClient.chooseOrder = async (order) => {
    intent = { ...intent, order };
    return intent;
  };
  identityClient.createShare = async () => LAB_SHARE_CODE;
  identityClient.joinedShare = async () => labJoinedShare(screen);
  identityClient.openShare = async (code) => {
    if (code !== LAB_SHARE_CODE) throw new IdentityRequestError(404, "share_unknown");
    return LAB_INVITE;
  };
  let sealCode = labSealCode(screen);
  identityClient.getSealCode = async () => sealCode;
  identityClient.redeemSealCode = async (code) => {
    if (code.trim().toUpperCase() !== LAB_SEAL_CODE)
      throw new IdentityRequestError(410, "code_unavailable" satisfies SealCodeRefusal);
    sealCode = { held: true };
    return sealCode;
  };
  identityClient.priceFragments = async (_game, fragments) => ({
    fragments,
    cents: fragments,
    quote: {
      ...LAB_FRAGMENT_QUOTE,
      lordsWei: String((BigInt(LAB_FRAGMENT_QUOTE.lordsWei) * BigInt(fragments)) / 1_000n),
    },
  });
  identityClient.payFragments = async () => ({ state: "delivering" });
  identityClient.fragmentPayment = async () => ({ state: "delivered", fragments: 1_000 });
  // The lab's player has made no Realms wallet, so the payout window offers Create my wallet.
  identityClient.readDefaultWallet = async () => null;
  answerLabBuildOrders();
  Object.assign(identityClient, {
    unlinkWallet: spend,
    linkWallet: async ({ code }: { code?: string }) => spend(code).then(() => LAB_PLAYER),
    deleteAccount: spend,
  });
};

/** The screen's player by name: the one their session carries and the one identity answers for them. */
const labPlayerName = (screen: LabScreen) => LAB_NAMES[screen] ?? LAB_SESSION.user.name;

const profilesOf = (screen: LabScreen, accounts: readonly string[]) =>
  Object.fromEntries(
    accounts.flatMap((account) => {
      const profile =
        BigInt(account) === BigInt(LAB_PLAYER)
          ? { name: labPlayerName(screen), portrait: LAB_SESSION.user.image }
          : (LAB_PROFILES[account] ?? LAB_CHAT_PROFILES.get(BigInt(account)));
      return profile ? [[account, profile]] : [];
    }),
  );
