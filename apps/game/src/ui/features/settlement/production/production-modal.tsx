import { lazy, Suspense, type ComponentProps } from "react";

import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ProductionPopupShell } from "./production-popup-shell";

const ProductionContent = lazy(() =>
  import("./production-modal-content").then((module) => ({ default: module.ProductionModal })),
);

export const ProductionModal = (props: ComponentProps<typeof ProductionContent>) => (
  <Suspense
    fallback={
      <ProductionPopupShell>
        <LoadingAnimation />
      </ProductionPopupShell>
    }
  >
    <ProductionContent {...props} />
  </Suspense>
);
