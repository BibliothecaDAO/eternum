import { lazy, Suspense } from "react";

import { Loading } from "./kit";

const FactoryV2Content = lazy(() =>
  import("@/ui/features/factory-v2/components/factory-v2-content").then((module) => ({
    default: module.FactoryV2Content,
  })),
);

/** Scheduling slots and seasons; loaded only when an operator opens it. */
export const FactoryPage = () => (
  <Suspense fallback={<Loading />}>
    <FactoryV2Content />
  </Suspense>
);
