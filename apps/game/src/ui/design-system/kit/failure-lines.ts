/** The services the app reads; a failure names the one that did not answer. */
export type Service =
  | "directory"
  | "slots"
  | "season"
  | "results"
  | "world"
  | "notifications"
  | "devices"
  | "identity"
  | "ratings"
  | "chat"
  | "ledger";

/** One line per service, in the glossary's shape ("Season did not answer."). */
const FAILURE_LINES: Record<Service, string> = {
  directory: "Games did not answer.",
  slots: "Blitz did not answer.",
  season: "Season did not answer.",
  results: "Results did not answer.",
  /** Entering a match: the shard, its world or its scene did not open. */
  world: "The world did not answer.",
  notifications: "Notifications did not answer.",
  devices: "Devices did not answer.",
  identity: "Sign-in did not answer.",
  ratings: "Ratings did not answer.",
  chat: "Chat did not answer.",
  /** The value ledger, or a ledger on another chain than this build's (the console names which). */
  ledger: "The ledger did not answer.",
};

/** A service's one line, for a surface that draws the failure in its own place (the doorway's plate). */
export const failureLine = (service: Service): string => FAILURE_LINES[service];
