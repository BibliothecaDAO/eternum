/** The services the app reads; a failure names the one that did not answer. */
export type Service =
  | "directory"
  | "season"
  | "results"
  | "world"
  | "notifications"
  | "devices"
  | "identity"
  | "chat"
  | "ledger"
  | "market";

/** One line per service, in the glossary's shape ("Season did not answer."). */
const FAILURE_LINES: Record<Service, string> = {
  directory: "Games unavailable.",
  season: "Season unavailable.",
  results: "Results unavailable.",
  /** Entering a match: the shard, its world or its scene did not open. */
  world: "World unavailable.",
  notifications: "Notifications unavailable.",
  devices: "Devices unavailable.",
  identity: "Sign-in unavailable.",
  chat: "Chat unavailable.",
  /** The value ledger, or a ledger on another chain than this build's (the console names which). */
  ledger: "Ledger unavailable.",
  market: "Market unavailable.",
};

/** A service's one line, for a surface that draws the failure in its own place (the doorway's plate). */
export const failureLine = (service: Service): string => FAILURE_LINES[service];
