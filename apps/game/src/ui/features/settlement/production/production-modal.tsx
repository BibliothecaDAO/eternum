import { lazy, Suspense, type ComponentProps } from "react";

import { HudLoading } from "@/ui/design-system/kit/hud-elements";
import { ProductionPopupShell } from "./production-popup-shell";

const ProductionContent = lazy(() =>
  import("./production-modal-content").then((module) => ({ default: module.ProductionModal })),
);

export const ProductionModal = (props: ComponentProps<typeof ProductionContent>) => (
  <Suspense
    fallback={
      <ProductionPopupShell>
        <HudLoading line="Loading production…" />
      </ProductionPopupShell>
    }
  >
    <ProductionContent {...props} />
  </Suspense>
);
