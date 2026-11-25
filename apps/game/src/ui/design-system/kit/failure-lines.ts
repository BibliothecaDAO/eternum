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
  directory: "Could not load games.",
  season: "Could not load Season.",
  results: "Could not load results.",
  /** Entering a match: the shard, its world or its scene did not open. */
  world: "Could not load the world.",
  notifications: "Could not load notifications.",
  devices: "Could not load devices.",
  identity: "Could not load sign-in.",
  chat: "Could not load chat.",
  /** The value ledger, or a ledger on another chain than this build's (the console names which). */
  ledger: "Could not load ledger.",
  market: "Could not load market.",
};

/** A service's one line, for a surface that draws the failure in its own place (the doorway's plate). */
export const failureLine = (service: Service): string => FAILURE_LINES[service];
