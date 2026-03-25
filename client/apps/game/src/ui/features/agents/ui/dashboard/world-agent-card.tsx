import type { MyAgentSummary } from "@bibliothecadao/types";
import { Bot, CircleAlert, LoaderCircle, Rocket, ShieldCheck } from "lucide-react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

export const WorldAgentCard = ({
  title,
  subtitle,
  agent,
  isSelected,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  agent?: MyAgentSummary | null;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const statusLabel = !agent
    ? "No agent yet"
    : agent.setup.status === "launching"
      ? "Launching"
      : agent.setup.status === "pending_auth"
        ? "Pending auth"
        : agent.setup.status === "error"
          ? "Error"
          : agent.autonomy.enabled
            ? "Autonomy enabled"
            : "Ready";

  const Icon = !agent
    ? Rocket
    : agent.setup.status === "error"
      ? CircleAlert
      : agent.setup.status === "pending_auth" || agent.setup.status === "launching"
        ? LoaderCircle
        : ShieldCheck;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border bg-black/40 p-4 text-left transition-all",
        isSelected ? "border-gold/60 bg-gold/10" : "border-gold/15 hover:border-gold/30 hover:bg-black/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gold">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-gold/50">{subtitle}</div> : null}
          <div className="mt-3 flex items-center gap-2 text-sm text-gold/80">
            <Icon className={cn("h-4 w-4", agent?.setup.status === "launching" && "animate-spin")} />
            <span>{statusLabel}</span>
          </div>
          {agent ? (
            <div className="mt-2 text-xs text-gold/55">
              {agent.displayName}
              {agent.activeSteeringJob ? ` · ${agent.activeSteeringJob.label}` : ""}
            </div>
          ) : (
            <div className="mt-2 text-xs text-gold/45">Launch your world agent from here.</div>
          )}
        </div>

        <div className="rounded-xl border border-gold/10 bg-black/30 p-2">
          <Bot className="h-4 w-4 text-gold/75" />
        </div>
      </div>
    </button>
  );
};
