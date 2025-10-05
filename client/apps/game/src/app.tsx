import { initPostHog } from "@/posthog";
import { cleanupTracing } from "@/tracing";
import { ErrorBoundary, TransactionNotification, WorldLoading } from "@/ui/shared";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { env } from "../env";
import { DojoProvider } from "./hooks/context/dojo-context";
import { MetagameProvider } from "./hooks/context/metagame-provider";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import "./index.css";
import type { SetupResult } from "./init/bootstrap";
import { bootstrapGame } from "./init/bootstrap";
import { initializeServiceWorkerUpdates } from "./init/service-worker";
import { IS_MOBILE } from "./ui/config";
import { StoryEventToastBridge, StoryEventToastProvider } from "./ui/features/story-events";
import { LandingLayout } from "./ui/layouts/landing";
import { World } from "./ui/layouts/world";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { MobileBlocker } from "./ui/modules/mobile-blocker";
import { getRandomBackgroundImage } from "./ui/utils/utils";

type GameRouteStatus = "loading" | "ready" | "error";

type ReadyAppProps = {
  backgroundImage: string;
  setupResult: SetupResult;
};

const ReadyApp = ({ backgroundImage, setupResult }: ReadyAppProps) => {
  return (
    <DojoProvider value={setupResult} backgroundImage={backgroundImage}>
      <MetagameProvider>
        <ErrorBoundary>
          <StoryEventToastProvider>
            <StoryEventToastBridge />
            <TransactionNotification />
            <World backgroundImage={backgroundImage} />
            <WorldLoading />
          </StoryEventToastProvider>
        </ErrorBoundary>
      </MetagameProvider>
    </DojoProvider>
  );
};

const BootstrapError = ({ error, onReload }: { error?: Error | null; onReload: () => void }) => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0f0f0f] p-6 text-center text-white">
      <h1 className="text-xl font-semibold">Unable to start Eternum</h1>
      <p className="mt-2 max-w-md text-sm text-white/70">
        Something went wrong while preparing the world. Please try reloading the page.
      </p>
      {error?.message ? <p className="mt-2 max-w-md text-xs text-white/50">{error.message}</p> : null}
      <button
        className="mt-6 rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={onReload}
      >
        Reload
      </button>
    </div>
  );
};

const GameRoute = ({ backgroundImage }: { backgroundImage: string }) => {
  const [status, setStatus] = useState<GameRouteStatus>("loading");
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;

    setStatus("loading");
    setBootstrapError(null);
    setSetupResult(null);

    bootstrapGame()
      .then((result) => {
        if (isCancelled) return;
        setSetupResult(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        console.error("[DOJO SETUP FAILED]", error);
        const normalizedError = error instanceof Error ? error : new Error("Unknown bootstrap error");
        setBootstrapError(normalizedError);
        setStatus("error");
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (status === "error") {
    return <BootstrapError error={bootstrapError} onReload={() => window.location.reload()} />;
  }

  if (status === "loading" || !setupResult) {
    return <LoadingScreen backgroundImage={backgroundImage} />;
  }

  return <ReadyApp backgroundImage={backgroundImage} setupResult={setupResult} />;
};

function App() {
  const isConstructionMode = env.VITE_PUBLIC_CONSTRUCTION_FLAG == true;
  const isMobileBlocked = !isConstructionMode && IS_MOBILE;
  const [backgroundImage] = useState(() => getRandomBackgroundImage());

  useEffect(() => {
    initPostHog();

    const handleBeforeUnload = () => {
      cleanupTracing();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    initializeServiceWorkerUpdates();

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      cleanupTracing();
    };
  }, []);

  if (isConstructionMode) {
    return <ConstructionGate />;
  }

  if (isMobileBlocked) {
    return <MobileBlocker mobileVersionUrl={env.VITE_PUBLIC_MOBILE_VERSION_URL} />;
  }

  return (
    <StarknetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingLayout backgroundImage={backgroundImage} />} />
          <Route path="/play/*" element={<GameRoute backgroundImage={backgroundImage} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StarknetProvider>
  );
}

export default App;
