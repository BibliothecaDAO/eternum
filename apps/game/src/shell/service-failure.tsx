import { useEffect } from "react";

import { Button } from "@/ui/design-system/kit/button";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { TRY_AGAIN } from "@/ui/design-system/kit/words";

/** The services the app reads; a failure names the one that did not answer. */
type Service =
  | "directory"
  | "slots"
  | "join"
  | "season"
  | "results"
  | "world"
  | "notifications"
  | "devices"
  | "identity"
  | "ratings";

/** One line per service, in the glossary's shape ("Season did not answer."). */
const FAILURE_LINES: Record<Service, string> = {
  directory: "Games did not answer.",
  slots: "Blitz did not answer.",
  /** A Join the launch service did not take: the seat was not taken either. */
  join: "Blitz did not answer. Your seat was not taken.",
  season: "Season did not answer.",
  results: "Results did not answer.",
  /** Entering a match: the shard, its world or its scene did not open. */
  world: "The world did not answer.",
  notifications: "Notifications did not answer.",
  devices: "Devices did not answer.",
  identity: "Sign-in did not answer.",
  ratings: "Ratings did not answer.",
};

/** A service's one line, for a surface that draws the failure in its own place (the doorway's plate). */
export const failureLine = (service: Service): string => FAILURE_LINES[service];

/**
 * A read that failed: the service's one line with Try again on it. The service's own words (a status, a code, a host)
 * go to the console for the operator, never onto the page.
 */
export const ServiceFailure = ({ service, error, retry }: { service: Service; error: unknown; retry?: () => void }) => {
  useEffect(() => {
    console.error("shell_read_failed", { service, error });
  }, [error, service]);
  return (
    <ReasonPlate
      reason={{ kind: "failed", line: FAILURE_LINES[service] }}
      step={retry && <Button role="outline" word={TRY_AGAIN} onClick={retry} />}
    />
  );
};
