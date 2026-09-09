/**
 * Game route module - lazy loaded to avoid pulling heavy deps (World, Dojo, Three.js, etc.)
 * into the landing page bundle.
 */
import { ChunkTransitionIndicator, ErrorBoundary, WorldLoading } from "@/ui/shared";
import { TransactionAudioCues } from "@/ui/shared/components/transaction-audio-cues";
import { useEffect } from "react";
import { PlaySceneHandoff } from "./game-entry/play-scene-handoff";
import { markGameEntryMilestone } from "./ui/layouts/game-entry-timeline";
import { Navigate, useNavigate } from "react-router-dom";
import type { Account, AccountInterface } from "starknet";
import { usePlayRouteBootController } from "./game-entry/play-route-boot";
import { DojoProvider } from "./hooks/context/dojo-context";
import { useTransactionListener } from "./hooks/use-transaction-listener";
import type { SetupResult } from "./init/bootstrap";
import { PlayRouteBootstrapErrorScreen } from "./ui/layouts/play-route-bootstrap-error-screen";
import { PlayRouteReconnectScreen } from "./ui/layouts/play-route-reconnect-screen";
import { NewsHeadlineBridge } from "./ui/features/news-headlines";
import { StoryEventAudioCues } from "./ui/features/story-events";
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
        <PlaySceneHandoff />
        <StoryEventAudioCues />
        <NewsHeadlineBridge />
        <TransactionListenerBridge />
        <TransactionAudioCues />
        <World backgroundImage={backgroundImage} />
        <ChunkTransitionIndicator />
        <WorldLoading />
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
    error,
    retry,
    isReconnectRequired,
    currentTask,
    tasks,
    bootToken,
    reconnectError,
  } = state;
  const hasActiveBoot = bootToken > 0;
  const routeView = resolveGameRouteView({
    phase,
    hasSetupResult: hasActiveBoot && setupResult !== null,
    hasAccount: account !== null,
    isReconnectRequired,
  });
  useBootDocumentState(
    phase === "ready" ? "app-ready" : "app-loading",
    phase === "ready" ? "boot_world_visible" : "boot_react_loader_visible",
  );

  useEffect(() => {
    markGameEntryMilestone("overlay-mounted");
  }, [bootToken]);

  const currentTaskLabel = resolveCurrentTaskLabel({ currentTask, phase, tasks });

  if (routeView === "redirect") {
    return <Navigate to="/" replace />;
  }

  if (routeView === "error") {
    return <PlayRouteBootstrapErrorScreen error={error} onRetry={retry} onReturnToDashboard={() => navigate("/")} />;
  }

  if (routeView === "reconnect") {
    return <PlayRouteReconnectScreen onReturnToDashboard={() => navigate("/")} reconnectError={reconnectError} />;
  }

  const hasGameContext = routeView === "ready" && setupResult !== null && account !== null;
  return (
    <>
      {phase !== "ready" && (
        <LoadingScreen
          title="Entering the World"
          subtitle={hasGameContext ? "Preparing your view…" : "Connecting to the world…"}
          progress={progress > 0 ? progress : undefined}
          currentTaskLabel={currentTaskLabel}
        />
      )}
      {hasGameContext && (
        <ReadyApp key={bootToken} backgroundImage={backgroundImage} setupResult={setupResult} account={account} />
      )}
    </>
  );
};

/** @public Lazy route entry consumed by app-level dynamic imports. */
export default GameRoute;
