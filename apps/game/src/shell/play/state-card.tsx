import { ServiceFailure } from "../service-failure";
import { paintingSources } from "./ages";

/** A card in a failure state: the storm painting and the failure owner's one line with its verb. */
export const StateCard = ({
  service,
  error,
  retry,
}: {
  service: Parameters<typeof ServiceFailure>[0]["service"];
  error: unknown;
  retry: () => void;
}) => (
  <section className="flex flex-col gap-3 rounded-2xl border border-kit-line bg-kit-plate p-3.5">
    <img
      {...paintingSources("stormy")}
      sizes="(min-width: 1024px) 34rem, 100vw"
      alt=""
      className="h-36 w-full rounded-xl object-cover"
    />
    <ServiceFailure service={service} error={error} retry={retry} />
  </section>
);
