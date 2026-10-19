// @vitest-environment jsdom
import { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { costLine } from "@/ui/design-system/kit/words";
import { RequirementChips } from "./requirement-chips";

it("writes a cost as the Build card does, the cost first and then what is held, the noun where nothing paints it", () => {
  expect(costLine(10, 1_574.6, ResourcesIds.Labor)).toBe("10 Labor (you have 1,574)");
  expect(costLine(1_200, undefined, ResourcesIds.Wood)).toBe("1,200 Wood");
  expect(costLine(11, 3_800)).toBe("11 (you have 3,800)");
});

it("reads a cost chip as the cost and then what is held, never as a fraction of held over needed", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <RequirementChips
        requirements={[
          { resource: ResourcesIds.Labor, amount: 11, current: 3_800 },
          { resource: ResourcesIds.Wood, amount: 50, current: undefined },
        ]}
      />,
    ),
  );
  const chips = [...host.querySelectorAll("[data-tip]")];
  expect(chips.map((chip) => chip.textContent)).toEqual(["11 (you have 3,800)", "50"]);
  expect(chips.map((chip) => chip.getAttribute("data-tip"))).toEqual(["11 Labor (you have 3,800)", "50 Wood"]);
  act(() => root.unmount());
  host.remove();
});
