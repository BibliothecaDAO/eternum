/**
 * The one way the client calls its own /api (the identity and launch Workers behind the app's origin). A read that has
 * not answered after API_READ_TIMEOUT_MS fails, so the screen that asked draws its failure line with Try again instead
 * of loading forever. Writes carry no timeout: abandoning one would leave its outcome unknown (a seat taken or not).
 *
 * Fifteen seconds sits above the slowest deadline a service keeps for itself (the rating top list's 10 s cold scan,
 * lobby-chat-mmr.txt), so a slow service still answers with its own error first, and well above a healthy read
 * (directory and history answer in under a second on the dev stack).
 */
export const API_READ_TIMEOUT_MS = 15_000;

export const fetchApi = (input: string | URL, init: Omit<RequestInit, "signal"> = {}): Promise<Response> =>
  fetch(input, isRead(init) ? { ...init, signal: timeoutSignal(API_READ_TIMEOUT_MS) } : init);

const isRead = (init: RequestInit) => (init.method ?? "GET").toUpperCase() === "GET";

/** Aborts after the given time; a request already answered ignores it. */
const timeoutSignal = (milliseconds: number) => {
  const controller = new AbortController();
  setTimeout(
    () => controller.abort(new DOMException("The app's service did not answer in time", "TimeoutError")),
    milliseconds,
  );
  return controller.signal;
};
