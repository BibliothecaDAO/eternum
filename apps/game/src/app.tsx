import { lazy, Suspense, type ReactNode } from "react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
// The HUD sheet's classes, read by its elements and by the few app-wide surfaces drawn in its look (the tooltip).
import "./ui/design-system/kit/hud-sheet.css";
import { PwaUpdateRuntime } from "./pwa/pwa-update-prompt";
import { SceneRoute } from "./scene-route";
import { PwaInstallRuntime } from "./pwa/pwa-install-control";
import { appQueryClient } from "./runtime/query-client";
import { AppShell } from "./shell/app-shell";
import { WhatsNewPage } from "./shell/news/news";
import { ChatPage } from "./shell/chat/chat-page";
import { IS_DEV_ENVIRONMENT } from "./shell/frame/environment";
import { NotFoundPage } from "./shell/not-found";
import { BlitzLobbyPage } from "./shell/blitz/blitz-pages";
import { BuildOrdersPage } from "./shell/build-orders/build-orders-page";
import { JoinDevconPage } from "./shell/join/join-devcon-page";
import { PlayPage } from "./shell/play/play-page";
import { PlayerPage, ProfilePage, SettingsPage } from "./shell/profile/profile-pages";
import { ResultsPage } from "./shell/season-tab/results-page";
import { SeasonPage } from "./shell/season-tab/season-page";
import { FirstFrame } from "./shell/first-frame";
import { ConnectFlow } from "./shell/sign-in/connect-flow";
import { LAB_GAME_ROUTE } from "./lab/game/lab-shard";

const LabApp = lazy(() => import("./lab/lab-app").then((module) => ({ default: module.LabApp })));
const LabGameRoute = lazy(() =>
  import("./lab/game/lab-game-route").then((module) => ({ default: module.LabGameRoute })),
);
// Reading matter loads on demand, so the cold path carries no post or legal text.
const TermsPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.TermsPage })));
const PrivacyPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.PrivacyPage })));
const CreditsPage = lazy(() => import("./shell/legal").then((module) => ({ default: module.CreditsPage })));
const GameClientApp = lazy(() => import("./game-client-app").then((module) => ({ default: module.GameClientApp })));

const AppFallback = FirstFrame;

/**
 * Former pages: Play's, shared publicly before Play took them in, and the sign-in page Connect replaced (a link to it,
 * or a Discord return started before it went): each leads to Play. `public/_redirects` answers a full load with a
 * permanent redirect; these routes answer the app's own navigation and the dev server, which serve the shell for every
 * path.
 */
export const RETIRED_PATHS = ["/blitz", "/frontier", "/eternum", "/dominion", "/sign-in"] as const;

const LazyRoute = ({ children }: { children: ReactNode }) => <Suspense fallback={<AppFallback />}>{children}</Suspense>;

/**
 * Every page the app serves. Cloudflare Pages rewrites to the app shell only the paths `public/_redirects` names, so
 * `app-hosting.test.ts` holds that file to exactly these routes.
 */
export const appRoutes = (
  <>
    <Route element={<AppShell />}>
      <Route index element={<PlayPage />} />
      {RETIRED_PATHS.map((path) => (
        <Route key={path} path={path.slice(1)} element={<Navigate to="/" replace />} />
      ))}
      <Route path="blitz/build-orders" element={<BuildOrdersPage />} />
      <Route path="blitz/:id" element={<BlitzLobbyPage />} />
      <Route path="join/devcon" element={<JoinDevconPage />} />
      <Route path="join/devcon/:code" element={<JoinDevconPage />} />
      <Route path="season" element={<SeasonPage />} />
      <Route path="results/:id" element={<ResultsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="profile/settings" element={<SettingsPage />} />
      <Route path="p/:address" element={<PlayerPage />} />
      <Route path="scroll" element={<WhatsNewPage />} />
      <Route path="chat" element={<ChatPage />} />
      <Route
        path="terms"
        element={
          <LazyRoute>
            <TermsPage />
          </LazyRoute>
        }
      />
      <Route
        path="privacy"
        element={
          <LazyRoute>
            <PrivacyPage />
          </LazyRoute>
        }
      />
      <Route
        path="credits"
        element={
          <LazyRoute>
            <CreditsPage />
          </LazyRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    <Route
      path="/g/:chain/:game/*"
      element={
        <SceneRoute fallback={<AppFallback />}>
          <GameClientApp />
        </SceneRoute>
      }
    />
    {IS_DEV_ENVIRONMENT && (
      <Route
        path="/lab/*"
        element={
          <LazyRoute>
            <LabApp />
          </LazyRoute>
        }
      />
    )}
    {IS_DEV_ENVIRONMENT && (
      <Route
        path={LAB_GAME_ROUTE}
        element={
          <LazyRoute>
            <LabGameRoute />
          </LazyRoute>
        }
      />
    )}
  </>
);

/**
 * One app: the shell (home, play, results, account) is the cold path and carries no game module; a game, with the
 * 3D client and its mode's screens, loads only under `/g/:chain/:game`.
 */
function App() {
  useKeyboardInset();
  return (
    <BrowserRouter>
      <QueryClientProvider client={appQueryClient}>
        <PwaUpdateRuntime />
        <PwaInstallRuntime />
        <Routes>{appRoutes}</Routes>
        <ConnectFlow />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
