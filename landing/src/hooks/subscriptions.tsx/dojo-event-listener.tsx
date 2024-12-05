import { PropsWithChildren } from "react";
import { useSubscriptionToHyperstructureEvents } from "./use-subscription-to-hyperstructure-events";

export function DojoEventListener({ children }: PropsWithChildren) {
  useSubscriptionToHyperstructureEvents();

  return <>{children}</>;
}
