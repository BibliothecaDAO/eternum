import { canonicalRealm } from "@bibliothecadao/eternum";
import type { HeraldAspectRoster } from "@bibliothecadao/eternum/game-sync";
import { aspects, catalogOrder, RESOURCE_PRECISION, type AspectId } from "@bibliothecadao/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import {
  IdentityRequestError,
  SOCIAL_PROVIDERS,
  type InvitedFriends,
  type SealCodeRefusal,
} from "@realms-world/identity";

import { PageAddress } from "../frame/page-address";
import type { DirectoryGame } from "../herald";
import { CreditsPage, PrivacyPage, TermsPage } from "../legal";
import { WhatsNewPage } from "../news/news";
import { NotFoundPage } from "../not-found";
import { seasonPlayerAspect, seasonRealmId } from "../season";
import { chooseSeason } from "../season-pick";
import { STANDING_PROMPTS } from "../standing-prompts";
import { PlayPage } from "../play/play-page";
import { SharedLinkPage } from "../share/shared-link-page";
import { FragmentsPage } from "../shop/fragments-page";
import { CosmeticsPage } from "../cosmetics/cosmetics-page";
import { COSMETICS_PATH } from "../cosmetics/cosmetics-route";
import { answerAvnuRead, answerTokenBalances, isAvnuRead } from "./lab-pay-tokens";
import { PlayerPage, ProfilePage, SettingsRedirect } from "../profile/profile-pages";
import { PROFILE_PATH } from "../profile/settings-route";
import { FRAGMENTS_PATH } from "../shop/fragments-route";
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
import { LabConnect, LabDayShare, LabDoorway } from "./app-lab-flows";
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
        <Route path="season" element={<SeasonPage />} />
        <Route path="results/:id" element={<ResultsPage />} />
        <Route path={PROFILE_PATH.slice(1)} element={<ProfilePage />} />
        <Route path={`${PROFILE_PATH.slice(1)}/settings`} element={<SettingsRedirect />} />
        <Route path="p/:address" element={<PlayerPage />} />
        <Route path="scroll" element={<WhatsNewPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="connect/:step" element={<LabConnect />} />
        <Route path="doorway/:state" element={<LabDoorway />} />
        <Route path="s/:code" element={<SharedLinkPage />} />
        <Route path="share/day" element={<LabDayShare />} />
        <Route path={COSMETICS_PATH.slice(1)} element={<CosmeticsPage />} />
        <Route path={FRAGMENTS_PATH.slice(1)} element={<FragmentsPage />} />
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
const LAB_ASPECT_GLORY: Record<AspectId, readonly number[]> = {
  1: [5_120, 3_980, 2_940, 1_820, 1_150],
  2: [5_480, 4_210, 3_190, 2_140, 1_380],
  3: [4_850, 3_640, 2_610, 1_890, 980],
  4: [4_460, 3_280, 2_310, 1_540, 860],
};

const labRealmsForAspect = (aspectId: AspectId, count: number, excludeRealmId: number | null): number[] => {
  const found: number[] = [];
  for (let realmId = 1; realmId <= 8_000 && found.length < count; realmId += 1) {
    if (realmId === excludeRealmId) continue;
    const realm = canonicalRealm(realmId);
    if (realm.order !== 0 && catalogOrder(realm.order).aspect === aspectId) found.push(realmId);
  }
  return found;
};

const labAspectRoster = (
  aspectId: AspectId,
  total: number,
  ownAspect: AspectId | null,
  ownRealm: number | null,
): HeraldAspectRoster => {
  const rivals = Object.entries(LAB_PROFILES)
    .filter(([, profile]) => profile.name !== null)
    .map(([address]) => address);
  const gloryTiers = LAB_ASPECT_GLORY[aspectId];
  const realmIds = labRealmsForAspect(aspectId, gloryTiers.length, ownRealm);
  const start = ((aspectId - 1) * gloryTiers.length) % Math.max(1, rivals.length);
  const pick = (offset: number) => rivals[(start + offset) % rivals.length]!;
  const entries = gloryTiers.map((glory, index) => {
    const isOwnSlot = aspectId === ownAspect && ownRealm !== null && index === 1;
    return {
      owner: isOwnSlot ? LAB_PLAYER : pick(index),
      realmId: isOwnSlot ? ownRealm : realmIds[index]!,
      glory,
    };
  });
  return {
    game_id: "1",
    aspect: aspectId,
    total,
    offset: 0,
    limit: 10,
    members: entries.map(({ owner, realmId, glory }, index) => ({
      rank: index + 1,
      entity_id: String(realmId + 10_000),
      realm_id: realmId,
      owner,
      glory: String(BigInt(glory) * BigInt(RESOURCE_PRECISION)),
    })),
  };
};

const createLabClient = (screen: LabScreen, field: number | null) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (field === null)
    client.setQueryData(
      ["shell", "leaderboard", LAB_CHAIN, 1],
      screen === "season-unpublished" ? LAB_FRONTIER_UNPUBLISHED_BOARD : LAB_FRONTIER_BOARD,
    );
  client.setQueryData(["shell", "leaderboard", LAB_CHAIN, 3], LAB_FINAL_BOARDS[screen] ?? LAB_FRONTIER_FINAL_BOARD);
  const season = chooseSeason(
    LAB_SCREENS[screen].games.map((game) => ({ ...game, chainId: LAB_CHAIN })),
    LAB_SCREENS[screen].signedIn,
  );
  const ownAspect = seasonPlayerAspect(season);
  const ownRealm = seasonRealmId(season);
  for (const { id } of aspects) {
    const total = season?.aspect_members?.[id] ?? 12;
    client.setQueryData(["shell", "aspect-roster", LAB_CHAIN, 1, id], labAspectRoster(id, total, ownAspect, ownRealm));
  }
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
    "shareTally",
    "invitedFriends",
    "chooseOrder",
    "createInvite",
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

const LAB_INVITED_FRIENDS: InvitedFriends["friends"] = [
  { name: "Rowan", joinedAt: 1_763_600_000, glory: 140, state: "paid" },
  { name: "Rhoswen the Unbowed", joinedAt: 1_763_686_400, glory: 105, state: "reached" },
  { name: "Aldric", joinedAt: 1_763_772_800, glory: 45, state: "joined" },
];

const labInviteOf = (screen: LabScreen, order: number | null) => {
  const games: DirectoryGame[] = LAB_SCREENS[screen].games.map((game) => ({ ...game, chainId: LAB_CHAIN }));
  const season = chooseSeason(games, LAB_SCREENS[screen].signedIn);
  const seasonAspect = seasonPlayerAspect(season);
  if (season && seasonAspect !== null) {
    return { code: LAB_SHARE_CODE, aspect: seasonAspect, chainId: season.chainId, gameId: season.game_id };
  }
  const intentAspect = order !== null ? catalogOrder(order)?.aspect : undefined;
  return { code: LAB_SHARE_CODE, aspect: intentAspect ?? LAB_INVITE.moment, chainId: null, gameId: null };
};

const answerIdentity = (screen: LabScreen) => {
  identityClient.listSignInProviders = async () => ["discord"];
  identityClient.availableSignInProviders = async () => [...SOCIAL_PROVIDERS];
  identityClient.sendSignInCode = async () => ({ success: true, expires_at: Date.now() + 300_000 });
  const spend = async (code: unknown) => {
    if (code !== LAB_EMAIL_CODE) throw new IdentityRequestError(400, "INVALID_OTP");
  };
  identityClient.shareTally = async () => LAB_SHARE_TALLIES[screen] ?? LAB_NO_SHARES;
  identityClient.invitedFriends = async () => ({
    friends: LAB_SHARE_TALLIES[screen] ? LAB_INVITED_FRIENDS : [],
  });
  const baseIntent = labOrderIntent(screen);
  let intent =
    LAB_SHARE_TALLIES[screen] && baseIntent.order === null ? { ...baseIntent, order: LAB_INVITE.order } : baseIntent;
  identityClient.getOrderIntent = async () => intent;
  identityClient.chooseOrder = async (order) => {
    intent = { ...intent, order };
    return intent;
  };
  identityClient.createShare = async () => LAB_SHARE_CODE;
  identityClient.createInvite = async () => labInviteOf(screen, intent.order);
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
  identityClient.readDefaultWallet = async () => null;
  identityClient.addOpeningProgress = async () => ({ reached: [], seen: STANDING_PROMPTS });
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
