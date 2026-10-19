// @vitest-environment jsdom
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const layout = vi.hoisted(() => ({ lane: null as "portrait" | null }));
vi.mock("@/hooks/helpers/use-compact-hud", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCompactLane: () => layout.lane,
}));

import { BuildingCard } from "./select-preview-building";

afterEach(() => {
  document.body.innerHTML = "";
});

/** The controls a Build card offers for its type, by their names, on the desktop card or the phone's. */
const controlsOf = (count: number, lane: "portrait" | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  layout.lane = lane;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <BuildingCard
        buildingId={BuildingType.ResourceWheat}
        buildingName="Farm"
        resource={ResourcesIds.Wheat}
        onClick={() => {}}
        active={false}
        toolTip={<span />}
        requirements={[]}
        count={count}
        onBuild={() => {}}
        onPauseResumeAll={() => {}}
        onDestroy={() => {}}
      />,
    ),
  );
  const names = [...host.querySelectorAll("button")].map(
    (button) => button.getAttribute("aria-label") ?? button.textContent?.trim(),
  );
  act(() => root.unmount());
  return names;
};

it("offers pausing and destroying a building type only once one is built, on the desktop card", () => {
  expect(controlsOf(0, null)).not.toEqual(expect.arrayContaining(["Pause all"]));
  expect(controlsOf(0, null)).not.toEqual(expect.arrayContaining(["Destroy building"]));
  expect(controlsOf(1, null)).toEqual(expect.arrayContaining(["Pause all", "Destroy building"]));
});

it("offers pausing and destroying a building type only once one is built, on the phone's card", () => {
  expect(controlsOf(0, "portrait")).not.toEqual(expect.arrayContaining(["Pause all"]));
  expect(controlsOf(0, "portrait")).not.toEqual(expect.arrayContaining(["Destroy one"]));
  expect(controlsOf(1, "portrait")).toEqual(expect.arrayContaining(["Pause all", "Destroy one"]));
});
