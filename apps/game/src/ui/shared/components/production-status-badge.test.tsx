import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";

import { ProductionStatusBadge } from "./production-status-badge";

afterEach(() => useTooltipStore.setState({ tooltip: null }));

it("names a ring on the app's one tooltip, outside the panel that holds the ring, so no row of rings covers it", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <>
        <Tooltip />
        <ul data-testid="card" className="overflow-hidden">
          <li>
            <ProductionStatusBadge
              resource={ResourcesIds.Crossbowman}
              tooltipText="Crossbowman · 1,000 held"
              isProducing={false}
              timeRemainingSeconds={null}
              buildings={0}
              amount="1K"
            />
          </li>
        </ul>
      </>,
    ),
  );
  const ring = host.querySelector("[data-tip]")!;
  act(() => {
    const event = new MouseEvent("pointerover", { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    ring.dispatchEvent(event);
  });
  const tooltip = document.querySelector('[role="tooltip"]');
  expect(tooltip?.textContent).toBe("Crossbowman · 1,000 held");
  expect(tooltip?.closest('[data-testid="card"]')).toBeNull();
  act(() => root.unmount());
  host.remove();
});
