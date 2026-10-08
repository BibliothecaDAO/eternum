import type { ReactNode } from "react";

import { ServiceFailure } from "../service-failure";
import { paintingSources } from "../paintings";

/** The handoff's StateCard: a painting, one line naming what is so, and its one verb or none. */
export const StateCard = ({ painting, children }: { painting: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-2xl border border-kit-line bg-kit-plate p-3.5">
    <img
      {...paintingSources(painting)}
      sizes="(min-width: 1024px) 34rem, 100vw"
      alt=""
      className="h-36 w-full rounded-xl object-cover"
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
