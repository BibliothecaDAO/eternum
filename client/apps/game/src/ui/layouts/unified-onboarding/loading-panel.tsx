import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCw } from "lucide-react";

import type { BootstrapTask } from "@/hooks/context/use-unified-onboarding";
import Button from "@/ui/design-system/atoms/button";

const DEFAULT_LOADING_STATEMENTS = [
  "Gathering your armies...",
  "Forging alliances...",
  "Building strongholds...",
  "Mustering forces...",
  "Preparing the realm...",
  "Awakening ancient powers...",
  "Charting territories...",
  "Summoning heroes...",
] as const;

const STATEMENT_INTERVAL_MS = 3000;

interface LoadingPanelProps {
  tasks: BootstrapTask[];
  progress: number;
  error: Error | null;
  onRetry: () => void;
}

export const LoadingPanel = ({ tasks, progress, error, onRetry }: LoadingPanelProps) => {
  const [statementIndex, setStatementIndex] = useState(() =>
    Math.floor(Math.random() * DEFAULT_LOADING_STATEMENTS.length),
  );

  // Cycle through statements
  useEffect(() => {
    if (error) return;

    const interval = window.setInterval(() => {
      setStatementIndex((prev) => (prev + 1) % DEFAULT_LOADING_STATEMENTS.length);
    }, STATEMENT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [error]);

  const currentStatement = DEFAULT_LOADING_STATEMENTS[statementIndex];
  const displayProgress = progress === 100 ? 99 : progress;

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-danger/60 mb-4" />
        <h2 className="text-xl font-bold text-gold mb-2">Unable to Start</h2>
        <p className="text-sm text-white/70 max-w-md mb-2">
          Something went wrong while preparing the world.
        </p>
        {error.message && (
          <p className="text-xs text-white/50 max-w-md mb-4 font-mono bg-black/20 px-3 py-2 rounded">
            {error.message}
          </p>
        )}
        <Button variant="outline" onClick={onRetry} className="mt-2">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <img
          src="/images/logos/eternum-loader.png"
          className="mx-auto w-24 mb-4"
          alt="Loading"
        />
        <h2 className="text-lg font-semibold text-gold">{currentStatement}</h2>
      </div>

      {/* Task list */}
      <div className="flex-1 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
              task.status === "running"
                ? "bg-gold/10 border border-gold/30"
                : task.status === "complete"
                  ? "bg-brilliance/5 border border-brilliance/20"
                  : task.status === "error"
                    ? "bg-danger/10 border border-danger/30"
                    : "bg-white/5 border border-white/10"
            }`}
          >
            {task.status === "running" ? (
              <Loader2 className="w-4 h-4 text-gold animate-spin flex-shrink-0" />
            ) : task.status === "complete" ? (
              <Check className="w-4 h-4 text-brilliance flex-shrink-0" />
            ) : task.status === "error" ? (
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/30 flex-shrink-0" />
            )}
            <span
              className={`text-sm ${
                task.status === "running"
                  ? "text-gold"
                  : task.status === "complete"
                    ? "text-brilliance/80"
                    : task.status === "error"
                      ? "text-danger"
                      : "text-white/40"
              }`}
            >
              {task.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-gold/60 mb-2">
          <span>Loading...</span>
          <span>{displayProgress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gold/10">
          <div
            className="h-2 rounded-full bg-gold transition-all duration-300"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
