import { Effect } from "effect";

interface JsonResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * The one HTTP boundary helper. It only turns a fetch into an Effect with the
 * parsed body; each service maps status and shape into its own typed errors.
 */
export const requestJson = (url: string, init?: RequestInit): Effect.Effect<JsonResponse, unknown> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, init);
      const text = await response.text();
      const body: unknown = text.length > 0 ? JSON.parse(text) : null;
      return { status: response.status, body };
    },
    catch: (cause) => cause,
  });
