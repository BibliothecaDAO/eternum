import { describe, expect, it } from "vitest";
import { resolveUrlChangedListenerLifecycle } from "./worldmap-lifecycle-policy";

describe("worldmap lifecycle policy", () => {
  it("attaches urlChanged only once across repeated setup calls", () => {
    const firstSetup = resolveUrlChangedListenerLifecycle({
      phase: "setup",
      isUrlChangedListenerAttached: false,
    });
    const secondSetup = resolveUrlChangedListenerLifecycle({
      phase: "setup",
      isUrlChangedListenerAttached: firstSetup.nextIsUrlChangedListenerAttached,
    });

    expect(firstSetup.shouldAttach).toBe(true);
    expect(secondSetup.shouldAttach).toBe(false);
    expect(secondSetup.nextIsUrlChangedListenerAttached).toBe(true);
  });

  it("detaches listener once on switch-off and stays detached on repeated switch-off/destroy", () => {
    const switchedOff = resolveUrlChangedListenerLifecycle({
      phase: "switchOff",
      isUrlChangedListenerAttached: true,
    });
    const switchedOffAgain = resolveUrlChangedListenerLifecycle({
      phase: "switchOff",
      isUrlChangedListenerAttached: switchedOff.nextIsUrlChangedListenerAttached,
    });
    const destroyedAfterSwitchOff = resolveUrlChangedListenerLifecycle({
      phase: "destroy",
      isUrlChangedListenerAttached: switchedOffAgain.nextIsUrlChangedListenerAttached,
    });

    expect(switchedOff.shouldDetach).toBe(true);
    expect(switchedOffAgain.shouldDetach).toBe(false);
    expect(destroyedAfterSwitchOff.shouldDetach).toBe(false);
    expect(destroyedAfterSwitchOff.nextIsUrlChangedListenerAttached).toBe(false);
  });

  it("supports setup after switch-off without stale attachment state", () => {
    const switchedOff = resolveUrlChangedListenerLifecycle({
      phase: "switchOff",
      isUrlChangedListenerAttached: true,
    });
    const resumedSetup = resolveUrlChangedListenerLifecycle({
      phase: "setup",
      isUrlChangedListenerAttached: switchedOff.nextIsUrlChangedListenerAttached,
    });

    expect(resumedSetup.shouldAttach).toBe(true);
    expect(resumedSetup.nextIsUrlChangedListenerAttached).toBe(true);
  });
});
