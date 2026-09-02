/**
 * Game route module - lazy loaded to avoid pulling heavy deps (World, Dojo, Three.js, etc.)
 * into the landing page bundle.
 */
import { ChunkTransitionIndicator, ErrorBoundary, WorldLoading } from "@/ui/shared";
import { EventFeedTicker } from "@/ui/features/event-feed/event-feed-ticker";
import { TransactionAudioCues } from "@/ui/shared/components/transaction-audio-cues";
import { Navigate, useNavigate } from "react-router-dom";
import type { Account, AccountInterface } from "starknet";
import { env } from "../env";
import { usePlayRouteBootController } from "./game-entry/play-route-boot";
import { DojoProvider } from "./hooks/context/dojo-context";
import { useTransactionListener } from "./hooks/use-transaction-listener";
import type { SetupResult } from "./init/bootstrap";
import { PlayRouteReconnectScreen } from "./ui/layouts/play-route-reconnect-screen";
import { NewsHeadlineBridge } from "./ui/features/news-headlines";
import { StoryEventToastBridge } from "./ui/features/story-events";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { useBootDocumentState } from "./ui/modules/boot-loader";
import { World } from "./ui/layouts/world";
import { resolveGameRouteView } from "./game-route.utils";
import type { BootstrapTask } from "./game-entry/bootstrap-controller";

type ReadyAppProps = {
  backgroundImage: string;
  setupResult: SetupResult;
  account: Account | AccountInterface;
};

const TransactionListenerBridge = () => {
  useTransactionListener();
  return null;
};

const ReadyApp = ({ backgroundImage, setupResult, account }: ReadyAppProps) => {
  return (
    <DojoProvider value={setupResult} account={account}>
      <ErrorBoundary>
        <StoryEventToastBridge />
        <NewsHeadlineBridge />
        <TransactionListenerBridge />
        <TransactionAudioCues />
        <World backgroundImage={backgroundImage} />
        <ChunkTransitionIndicator />
        <WorldLoading />
        <EventFeedTicker />
      </ErrorBoundary>
    </DojoProvider>
  );
};

const resolveCurrentTaskLabel = ({
  currentTask,
  phase,
  tasks,
}: {
  currentTask: string | null;
  phase: string;
  tasks: BootstrapTask[];
}): string => {
  const activeTask = currentTask
    ? tasks.find((task) => task.id === currentTask)
    : tasks.find((task) => task.status === "running");
  return activeTask?.label ?? currentTask ?? phase;
};

const GameRoute = ({ backgroundImage }: { backgroundImage: string }) => {
  const navigate = useNavigate();
  const state = usePlayRouteBootController();
  const {
    phase,
    progress,
    setupResult,
    account,
    connectWallet,
    retry,
    isReconnectRequired,
    currentTask,
    tasks,
    bootToken,
    reconnectError,
    reconnectStatus,
  } = state;
  const hasActiveBoot = bootToken > 0;
  const routeView = resolveGameRouteView({
    phase,
    hasSetupResult: hasActiveBoot && setupResult !== null,
    hasAccount: account !== null,
    isReconnectRequired,
  });
  useBootDocumentState(
    routeView === "loading" ? "app-loading" : routeView === "ready" ? "app-ready" : null,
    routeView === "ready" ? "boot_world_visible" : routeView === "loading" ? "boot_react_loader_visible" : undefined,
  );

  const currentTaskLabel = resolveCurrentTaskLabel({ currentTask, phase, tasks });

  if (routeView === "redirect") {
    return <Navigate to="/" replace />;
  }

  if (routeView === "reconnect") {
    return (
      <PlayRouteReconnectScreen
        onReconnect={connectWallet}
        onRetry={retry}
        onReturnToDashboard={() => navigate("/")}
        reconnectError={reconnectError}
        reconnectStatus={reconnectStatus}
        showRetry={phase === "error"}
      />
    );
  }

  if (routeView === "loading") {
    return (
      <LoadingScreen
        progress={progress > 0 ? progress : undefined}
        title="Charting the World"
        subtitle="Following contour lines while world state comes online."
        currentTaskLabel={currentTaskLabel}
      />
    );
  }

  if (!setupResult || !account) {
    return (
      <LoadingScreen
        title="Charting the World"
        subtitle="Resolving the last world details."
        currentTaskLabel={currentTaskLabel}
      />
    );
  }

  return <ReadyApp key={bootToken} backgroundImage={backgroundImage} setupResult={setupResult} account={account} />;
};

/** @public Lazy route entry consumed by app-level dynamic imports. */
export default GameRoute;
