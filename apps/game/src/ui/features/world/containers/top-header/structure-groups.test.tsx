import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

import { useStructureGroups } from "./structure-groups";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const loadedGroups = () => {
  let groups: ReturnType<typeof useStructureGroups>["structureGroups"] | undefined;
  const Probe = () => {
    groups = useStructureGroups().structureGroups;
    return null;
  };
  renderToString(<Probe />);
  return groups;
};

it("keeps a stored group under its exact structure id, and drops a malformed id instead of aliasing another", () => {
  const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.setItem("structureGroups", JSON.stringify({ "7": "red", "7abc": "amber", "1e1": "amber" }));

  expect(loadedGroups()).toEqual({ 7: "red" });
  expect(warned).toHaveBeenCalledTimes(2);
});
