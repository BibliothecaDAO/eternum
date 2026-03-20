import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFactoryMoreOptionsDraft } from "../map-options";
import { useFactoryV2MoreOptions } from "./use-factory-v2-map-options";

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type HookProps = Parameters<typeof useFactoryV2MoreOptions>[0];

let latestHookValue: ReturnType<typeof useFactoryV2MoreOptions> | null = null;

function HookHarness(props: HookProps) {
  latestHookValue = useFactoryV2MoreOptions(props);
  return null;
}

const buildProps = (overrides: Partial<HookProps> = {}): HookProps => ({
  mode: "blitz",
  chain: "slot",
  presetId: "blitz-open",
  twoPlayerMode: false,
  durationMinutes: 60,
  ...overrides,
});

describe("useFactoryV2MoreOptions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestHookValue = null;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    latestHookValue = null;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("resets Blitz more-options when the inferred duration profile changes", async () => {
    await act(async () => {
      root.render(<HookHarness {...buildProps({ durationMinutes: 60 })} />);
      await waitForAsyncWork();
    });

    await act(async () => {
      latestHookValue?.setValue("relicDiscoveryInterval", "12");
      await waitForAsyncWork();
    });

    expect(latestHookValue?.draft.relicDiscoveryInterval).toBe("12");

    await act(async () => {
      root.render(<HookHarness {...buildProps({ durationMinutes: 90 })} />);
      await waitForAsyncWork();
    });

    expect(latestHookValue?.draft).toEqual(createFactoryMoreOptionsDraft("blitz", "slot", 90));
    expect(latestHookValue?.sections.find((section) => section.id === "explorationRewards")?.previewRows).toHaveLength(
      9,
    );
  });

  it("keeps edited values when switching between custom Blitz durations", async () => {
    await act(async () => {
      root.render(<HookHarness {...buildProps({ durationMinutes: 30 })} />);
      await waitForAsyncWork();
    });

    await act(async () => {
      latestHookValue?.setValue("relicDiscoveryInterval", "12");
      await waitForAsyncWork();
    });

    await act(async () => {
      root.render(<HookHarness {...buildProps({ durationMinutes: 45 })} />);
      await waitForAsyncWork();
    });

    expect(latestHookValue?.draft.relicDiscoveryInterval).toBe("12");
  });

  it("updates the Blitz exploration reward preview when the duration changes", async () => {
    await act(async () => {
      root.render(<HookHarness {...buildProps({ durationMinutes: 60 })} />);
      await waitForAsyncWork();
    });

    expect(
      latestHookValue?.sections.find((section) => section.id === "explorationRewards")?.previewRows?.[0],
    ).toMatchObject({
      label: "Essence",
      amountLabel: "150",
      probabilityLabel: "35%",
    });

    await act(async () => {
      root.render(<HookHarness {...buildProps({ durationMinutes: 90 })} />);
      await waitForAsyncWork();
    });

    expect(
      latestHookValue?.sections.find((section) => section.id === "explorationRewards")?.previewRows?.[0],
    ).toMatchObject({
      label: "Essence",
      amountLabel: "100",
      probabilityLabel: "30%",
    });
  });
});
