import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useEffect, useMemo, useState } from "react";

import type { BootstrapTask } from "@/hooks/context/use-eager-bootstrap";
import Button from "@/ui/design-system/atoms/button";
import { getDisplayProgress, getNextStatementIndex } from "./bootstrap-loading-panel.utils";
import { BOOTSTRAP_LOADING_STATEMENTS } from "./constants";

const STATEMENT_INTERVAL_MS = 3000;

interface BootstrapLoadingPanelProps {
  tasks: BootstrapTask[];
  progress: number;
  error: Error | null;
  onRetry: () => void;
  statements?: readonly string[];
}

export const BootstrapLoadingPanel = ({
  tasks,
  progress,
  error,
  onRetry,
  statements = BOOTSTRAP_LOADING_STATEMENTS,
}: BootstrapLoadingPanelProps) => {
  const resolvedStatements = statements.length > 0 ? statements : BOOTSTRAP_LOADING_STATEMENTS;
  const [statementIndex, setStatementIndex] = useState(0);

  const statementCount = resolvedStatements.length;

  useEffect(() => {
    if (error || statementCount <= 1) return;

    const interval = window.setInterval(() => {
      setStatementIndex((prev) => getNextStatementIndex(prev, statementCount));
    }, STATEMENT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [error, statementCount]);

  const currentStatement = useMemo(() => {
    if (statementCount <= 0) return "Preparing the realm...";
    const safeIndex = statementIndex % statementCount;
    return resolvedStatements[safeIndex] ?? "Preparing the realm...";
  }, [resolvedStatements, statementCount, statementIndex]);

  const displayProgress = getDisplayProgress(progress);

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center">
        <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-danger/60 mb-3 sm:mb-4" />
        <h2 className="text-lg sm:text-xl font-bold text-gold mb-2">Unable to Start</h2>
        <p className="text-xs sm:text-sm text-white/70 max-w-md mb-2">
          Something went wrong while preparing the world.
        </p>
        {error.message && (
          <p className="text-xs text-white/50 max-w-md mb-4 font-mono bg-black/20 px-3 py-2 rounded">{error.message}</p>
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
      <div>
        <img src="/images/logos/eternum-loader.png" className="mx-auto w-20 sm:w-24 mb-3 sm:mb-4" alt="Loading" />
        <h2 className="text-base sm:text-lg font-semibold text-gold">{currentStatement}</h2>
      </div>

      <div className="flex-1 space-y-1.5 sm:space-y-2 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-300 ${
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
              className={`text-xs sm:text-sm ${
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

      <div className="mt-4 sm:mt-6">
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
