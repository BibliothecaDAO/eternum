import type { ReactNode } from "react";

/** Small presentational pieces shared by every screen; skin from the launcher artifact. */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-line-soft bg-panel p-4 backdrop-blur-sm ${className}`}>{children}</div>;
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-gold">{children}</h3>;
}

export function GoldButton({
  children,
  onClick,
  disabled,
  big,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cut inline-flex items-center justify-center gap-2 border border-[#f7cf7e] bg-gradient-to-b from-amber-hot to-[#b8730a] font-heading font-semibold uppercase tracking-[0.1em] text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:saturate-50 ${
        big ? "px-8 py-4 text-[15px] shadow-[0_0_28px_rgba(227,144,1,0.4)]" : "px-6 py-3 text-[13px]"
      }`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cut inline-flex items-center justify-center border border-line bg-inset px-5 py-3 font-heading text-[12px] font-semibold uppercase tracking-[0.12em] text-gold hover:border-amber-deep hover:text-amber-hot disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export type PillTone = "reg" | "live" | "done" | "cold";

const PILL_TONES: Record<PillTone, string> = {
  reg: "text-amber-hot border-amber-deep",
  live: "text-sage border-[#4c5433]",
  done: "text-faint border-line",
  cold: "text-steel border-[#3a4d5e]",
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatBlock({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border border-line-soft border-t-2 border-t-amber-deep bg-inset px-4 pt-3 pb-3">
      <span className="mb-2 block font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-faint">
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums text-parchment">{value}</span>
      {sub ? <span className="mt-1 block text-[11px] text-muted">{sub}</span> : null}
    </div>
  );
}

export function Flavor({ children }: { children: ReactNode }) {
  return <span className="font-flavor text-[15px] italic text-muted">{children}</span>;
}

/** One chokepoint for error copy: every typed failure renders as a sentence. */
export function describeError(error: unknown): string {
  const tag =
    typeof error === "object" && error !== null && "_tag" in error ? String((error as { _tag: string })._tag) : "";
  switch (tag) {
    case "ValuePlaneNotDeployed":
      return "The mainnet ledger is not deployed yet — value facts return once it lands.";
    case "HeraldUnreachable":
      return "Herald is unreachable, so live game facts are paused. Retrying.";
    case "IdentityUnreachable":
      return "The identity service is unreachable. Retrying.";
    case "RpcError":
      return "The mainnet RPC is not answering. Retrying.";
    case "BoundaryDecodeError":
      return "A data source answered in an unexpected shape — this is a bug worth reporting.";
    case "NoWalletFound":
      return "No Starknet wallet found. Install Ready or Braavos, then reload.";
    case "WalletNotConnected":
      return "Connect your wallet first.";
    case "WalletRequestFailed":
      return "The wallet declined the request.";
    case "TransactionFailed":
      return "The transaction failed on chain — nothing was charged beyond gas.";
    case "Unauthorized":
      return "Your session expired. Sign in again.";
    case "NameTaken":
      return "That name is already claimed.";
    case "NameInvalid":
      return "Names are 3–20 characters: letters, numbers, spaces, - or _.";
    default:
      return "Something failed. Retrying may help.";
  }
}

export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="border border-dashed border-amber-deep bg-amber/5 px-4 py-3 text-[13px] text-gold">
      {describeError(error)}
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="ml-3 font-mono text-[11px] uppercase tracking-wider text-amber-hot underline"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function Loading({ label = "Summoning…" }: { label?: string }) {
  return (
    <div className="px-1 py-6 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-faint">{label}</div>
  );
}
