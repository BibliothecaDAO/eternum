import { useCallback, useEffect, useRef, useState } from "react";
import { Cause, Exit, type Effect } from "effect";

import type { AppServices } from "@/runtime";
import { runtime } from "@/runtime";

export type AppEffect<A, E> = Effect.Effect<A, E, AppServices>;

export type QueryState<A, E> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly value: A }
  | { readonly kind: "error"; readonly error: E };

/**
 * Runs an Effect for a screen and optionally re-runs it on an interval. Results
 * live only in the mounted component — each mount refetches, so nothing here
 * becomes a second truth for a fact a service already serves.
 */
export function useQuery<A, E>(
  make: () => AppEffect<A, E>,
  deps: readonly unknown[],
  options?: { pollMs?: number },
): QueryState<A, E> & { refresh: () => void } {
  const [state, setState] = useState<QueryState<A, E>>({ kind: "loading" });
  const [epoch, setEpoch] = useState(0);
  const makeRef = useRef(make);
  makeRef.current = make;

  useEffect(() => {
    let alive = true;
    const run = () => {
      void runtime.runPromiseExit(makeRef.current()).then((exit) => {
        if (!alive) return;
        if (Exit.isSuccess(exit)) {
          setState({ kind: "ok", value: exit.value });
          return;
        }
        const failure = Cause.findErrorOption(exit.cause);
        if (failure._tag === "Some") setState({ kind: "error", error: failure.value });
        else console.error("realms query died", Cause.pretty(exit.cause));
      });
    };
    run();
    const timer = options?.pollMs ? setInterval(run, options.pollMs) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's cache key
  }, [...deps, epoch, options?.pollMs]);

  const refresh = useCallback(() => setEpoch((value) => value + 1), []);
  return { ...state, refresh };
}

export type MutationState<A, E> =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "ok"; readonly value: A }
  | { readonly kind: "error"; readonly error: E };

/** Runs a user-initiated Effect; pending/error/success as state, no retries. */
export function useMutation<Args extends unknown[], A, E>(make: (...args: Args) => AppEffect<A, E>) {
  const [state, setState] = useState<MutationState<A, E>>({ kind: "idle" });
  const run = useCallback(
    (...args: Args) => {
      setState({ kind: "pending" });
      return runtime.runPromiseExit(make(...args)).then((exit) => {
        if (Exit.isSuccess(exit)) {
          setState({ kind: "ok", value: exit.value });
          return exit.value;
        }
        const failure = Cause.findErrorOption(exit.cause);
        if (failure._tag === "Some") setState({ kind: "error", error: failure.value });
        else {
          console.error("realms mutation died", Cause.pretty(exit.cause));
          setState({ kind: "error", error: Cause.squash(exit.cause) as E });
        }
        return undefined;
      });
    },
    [make],
  );
  const reset = useCallback(() => setState({ kind: "idle" }), []);
  return { state, run, reset };
}
