import { useEffect, type ReactNode } from "react";

/** The shell's few presentational pieces: plain elements, so the shell carries no game module. */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gold/20 bg-black/60 p-4 backdrop-blur-sm ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-cinzel text-xs font-semibold uppercase tracking-[0.18em] text-gold">{children}</h2>;
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-cinzel text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function GoldButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} border border-gold/60 bg-gold text-brown hover:brightness-110`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} border border-gold/40 bg-transparent text-gold hover:bg-gold/10`}
    >
      {children}
    </button>
  );
}

export type PillTone = "open" | "live" | "done" | "cold";

const PILL_TONES: Record<PillTone, string> = {
  open: "border-gold/60 text-gold",
  live: "border-green/60 text-green",
  done: "border-gold/20 text-gold/50",
  cold: "border-gold/20 text-gold/70",
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="px-1 py-6 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-gold/50">
      {label}
    </div>
  );
}

/**
 * A read that failed renders as a named state ("Games are unavailable right now.") with a retry; the service's own
 * words (a status, a code) go to the console for the operator, never onto the page.
 */
export function ErrorPanel({ message, error, retry }: { message: string; error: unknown; retry?: () => void }) {
  useEffect(() => {
    console.error("shell_read_failed", { message, error });
  }, [error, message]);
  return (
    <div
      role="alert"
      className="rounded-lg border border-dashed border-danger/60 bg-danger/5 px-4 py-3 text-[13px] text-gold"
    >
      {message}
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="ml-3 font-mono text-[11px] uppercase tracking-wider text-gold underline"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
