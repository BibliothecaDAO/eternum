import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Effect } from "effect";

import { IdentityApi, type IdentitySession } from "@/services/identity";
import { Wallet } from "@/services/platform/wallet";
import { runtime } from "@/runtime";
import { useQuery } from "./hooks";

export type SessionStatus = "loading" | "ok" | "unreachable";

interface SessionContextValue {
  /** Meaningful only when status is "ok": the session, or null when signed out. */
  session: IdentitySession | null;
  status: SessionStatus;
  refresh: () => void;
}

const SessionContext = createContext<SessionContextValue>({ session: null, status: "loading", refresh: () => {} });

/**
 * One owner for the identity session in the tree. The API stays the truth —
 * this holds only the latest response for rendering, refreshed on demand and
 * on a slow poll so an expired cookie surfaces without a reload.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const query = useQuery(() => Effect.flatMap(IdentityApi, (identity) => identity.session), [], { pollMs: 60_000 });

  // Reconnect the last wallet silently once per app start so signing is ready.
  useEffect(() => {
    void runtime.runPromise(Effect.flatMap(Wallet, (wallet) => Effect.ignore(wallet.reconnect)));
  }, []);

  // An unreachable identity service is not "signed out" — the distinction keeps
  // the landing page from flashing at a signed-in player during an outage.
  const status: SessionStatus = query.kind === "ok" ? "ok" : query.kind === "error" ? "unreachable" : "loading";
  const session = query.kind === "ok" ? query.value : null;
  return (
    <SessionContext.Provider value={{ session, status, refresh: query.refresh }}>{children}</SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

/** Ticks every second for countdowns; presentation only, never a game fact. */
export function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
