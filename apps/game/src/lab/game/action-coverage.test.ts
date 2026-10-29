import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { frontierPreset } from "../../../../../config/source/frontier/native";
import { commandRoutes } from "../../../../../contracts/l3/world-native/schema/command-routes.mjs";
import { nativeCommandBits } from "../../../../../contracts/l3/world-native/schema/commands.gen";
import { STEP_SETS, UNMEASURED_COMMANDS } from "../../../scripts/client-playtest/steps.mjs";

/**
 * Click to result covers every player command: the game's command catalog (the routes the client sends) less what
 * Frontier's preset disables is the list, and each command on it is sent by a lab action step, played on desktop and
 * phone with baselines, or named in UNMEASURED_COMMANDS with why. A command added to the catalog or enabled for Frontier
 * fails here until it is measured or its exclusion is written down.
 */
const BASELINES = join(__dirname, "../../../scripts/client-playtest/baselines");

const frontierCommands = (commandRoutes as { name: keyof typeof nativeCommandBits }[])
  .map(({ name }) => name)
  .filter((name) => (frontierPreset.commandMask & BigInt(nativeCommandBits[name])) !== 0n);

type ActionStep = { name: string; sends?: string };
const labActionLists = Object.entries(STEP_SETS as Record<string, { steps: ActionStep[] }>).filter(([list]) =>
  list.startsWith("lab-actions"),
);
const measuredBy = new Map<string, { list: string; step: string }[]>();
for (const [list, { steps }] of labActionLists)
  for (const step of steps)
    if (step.sends) measuredBy.set(step.sends, [...(measuredBy.get(step.sends) ?? []), { list, step: step.name }]);

const baselineTimes = (list: string, device: "desktop" | "phone", step: string): boolean => {
  const path = join(BASELINES, `${list}-${device}.json`);
  if (!existsSync(path)) return false;
  const baseline = JSON.parse(readFileSync(path, "utf8")) as { byMode: Record<string, { steps: object }> };
  return Object.values(baseline.byMode).some(({ steps }) => step in steps);
};

describe("click-to-result coverage", () => {
  it("measures every command a Frontier player sends, or says why not", () => {
    const uncovered = frontierCommands.filter(
      (command) => !measuredBy.has(command) && !(UNMEASURED_COMMANDS as Record<string, string>)[command],
    );
    expect(uncovered).toEqual([]);
  });

  it("times each measured command on desktop and phone against a baseline", () => {
    const untimed = [...measuredBy].flatMap(([command, steps]) =>
      steps.flatMap(({ list, step }) =>
        (["desktop", "phone"] as const)
          .filter((device) => !baselineTimes(list, device, step))
          .map((device) => `${command} (${list}:${step}, ${device})`),
      ),
    );
    expect(untimed).toEqual([]);
  });

  it("names as unmeasured only Frontier commands no step sends, each with a reason", () => {
    for (const [command, reason] of Object.entries(UNMEASURED_COMMANDS as Record<string, string>)) {
      expect(frontierCommands).toContain(command);
      expect(measuredBy.has(command)).toBe(false);
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});
