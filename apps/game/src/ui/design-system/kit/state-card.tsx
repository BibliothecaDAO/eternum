import type { ReactNode } from "react";

import { paintingSources, type Painting } from "./paintings";
import { ServiceFailure } from "./service-failure";
import { cn } from "@/ui/design-system/atoms/lib/utils";

const IMAGES = { sm: "h-36", md: "h-40", lg: "h-44" } as const;

/**
 * The handoff's StateCard: a painting, one line naming what is so, and its one verb or none. Play's own cards are the
 * small one; a page's whole state (no season, nothing here) a taller painting, the roomier one with more air.
 */
export const StateCard = ({
  painting,
  image = "sm",
  pad = "3.5",
  sizes = "(min-width: 1024px) 34rem, 100vw",
  children,
}: {
  painting: Painting;
  image?: keyof typeof IMAGES;
  pad?: "3.5" | "4";
  /** The painting's displayed width for the browser's pick from its sizes, as the page lays the card out. */
  sizes?: string;
  children: ReactNode;
}) => (
  <section className={cn("plate flex flex-col", pad === "3.5" ? "gap-3 p-3.5" : "gap-4 p-4")}>
    <img
      {...paintingSources(painting)}
      sizes={sizes}
      alt=""
      className={cn("w-full rounded-control object-cover", IMAGES[image])}
    />
    {children}
  </section>
);

/** A card whose read failed: the storm, and the failing service's one line with Try again. */
export const FailureCard = ({
  service,
  error,
  retry,
}: {
  service: Parameters<typeof ServiceFailure>[0]["service"];
  error: unknown;
  retry: () => void;
}) => (
  <StateCard painting="stormy">
    <ServiceFailure service={service} error={error} retry={retry} />
  </StateCard>
);
