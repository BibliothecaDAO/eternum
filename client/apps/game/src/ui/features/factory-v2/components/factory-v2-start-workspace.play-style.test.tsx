import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFactoryMoreOptionsDraft } from "../map-options";
import { FactoryV2StartWorkspace } from "./factory-v2-start-workspace";

vi.mock("../mode-appearance", () => ({
  resolveFactoryModeAppearance: vi.fn(() => ({
    featureSurfaceClassName: "",
    quietSurfaceClassName: "",
    primaryButtonClassName: "",
    secondaryButtonClassName: "",
    listItemClassName: "",
  })),
}));

vi.mock("./factory-v2-more-options", () => ({
  FactoryV2MoreOptions: () => <div>More options</div>,
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createPreset = (mode: "blitz" | "eternum" = "blitz") => ({
  id: "preset-1",
  name: "Preset 1",
  mode,
  description: "Preset description",
  defaults: {
    startRule: "next_hour" as const,
    devMode: false,
    twoPlayerMode: false,
    singleRealmMode: false,
  },
});

const buildProps = (
  overrides: Partial<ComponentProps<typeof FactoryV2StartWorkspace>> = {},
): ComponentProps<typeof FactoryV2StartWorkspace> => ({
  mode: "blitz",
  modeLabel: "Blitz",
  environmentLabel: "Slot",
  isMainnet: false,
  presets: [createPreset()],
  selectedPreset: createPreset(),
  gameName: "bltz-sprint-01",
  startAt: "2026-03-18T12:00",
  durationMinutes: null,
  showsDuration: false,
  durationOptions: [],
  twoPlayerMode: false,
  singleRealmMode: false,
  existingGameName: null,
  notice: null,
  launchDisabledReason: null,
  moreOptionsOpen: false,
  moreOptionSections: [],
  moreOptionDraft: createFactoryMoreOptionsDraft("blitz", "slot"),
  moreOptionErrors: {
    shards: null,
    camp: null,
    agent: null,
    holysite: null,
    bitcoinMine: null,
    hyperstructureCenter: null,
    hyperstructureRadiusMultiplier: null,
    hyperstructureChanceLossPerFound: null,
    relicDiscoveryInterval: null,
    relicHexDistance: null,
    relicsPerChest: null,
    maxPlayers: null,
  },
  moreOptionsDisabledReason: null,
  onSelectPreset: vi.fn(),
  onGameNameChange: vi.fn(),
  onStartAtChange: vi.fn(),
  onDurationChange: vi.fn(),
  onToggleMapOptions: vi.fn(),
  onMapOptionValueChange: vi.fn(),
  onToggleTwoPlayerMode: vi.fn(),
  onToggleSingleRealmMode: vi.fn(),
  onFandomizeGameName: vi.fn(),
  onLaunch: vi.fn(),
  isWatcherBusy: false,
  ...overrides,
});

describe("FactoryV2StartWorkspace play style", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("splits the start card into clear launch sections", async () => {
    await act(async () => {
      root.render(<FactoryV2StartWorkspace {...buildProps()} />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Launch basics");
    expect(container.textContent).toContain("Blitz setup");
    expect(container.textContent).toContain("Advanced");
    expect(container.textContent).toContain("Max players");
  });

  it("uses a wide layout with a sticky mobile launch bar", async () => {
    await act(async () => {
      root.render(<FactoryV2StartWorkspace {...buildProps()} />);
      await waitForAsyncWork();
    });

    const article = container.querySelector("article");
    const actionBar = container.querySelector('[data-testid="factory-start-action-bar"]');

    expect(article?.className).toContain("w-full");
    expect(article?.className).not.toContain("max-w-md");
    expect(actionBar?.className).toContain("sticky");
  });

  it("keeps the Eternum start-time control shrink-safe on mobile", async () => {
    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            mode: "eternum",
            modeLabel: "Eternum",
            presets: [createPreset("eternum")],
            selectedPreset: createPreset("eternum"),
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const startDateInput = container.querySelector<HTMLInputElement>("#factory-start-date");
    const startTimeInput = container.querySelector<HTMLInputElement>("#factory-start-time");
    const launchGrid = startDateInput?.closest(".grid");
    const startDatePanel = startDateInput?.closest("label");
    const startTimePanel = startTimeInput?.closest("label");

    expect(container.querySelector("#factory-start-at")).toBeNull();
    expect(startDateInput?.className).toContain("min-w-0");
    expect(startDateInput?.className).toContain("max-w-full");
    expect(startDateInput?.className).toContain("overflow-hidden");
    expect(startDateInput?.className).toContain("[&::-webkit-datetime-edit]:overflow-hidden");
    expect(startTimeInput?.className).toContain("min-w-0");
    expect(startTimeInput?.className).toContain("max-w-full");
    expect(startTimeInput?.className).toContain("overflow-hidden");
    expect(startTimeInput?.className).toContain("[&::-webkit-datetime-edit]:overflow-hidden");
    expect(launchGrid?.className).toContain("min-w-0");
    expect(launchGrid?.className).toContain("sm:grid-cols-2");
    expect(startDatePanel?.className).toContain("rounded-[20px]");
    expect(startDatePanel?.className).toContain("overflow-hidden");
    expect(startTimePanel?.className).toContain("rounded-[20px]");
    expect(startTimePanel?.className).toContain("overflow-hidden");
  });

  it("lets the blitz schedule keep the full row when duration is shown", async () => {
    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            showsDuration: true,
            durationMinutes: 120,
            durationOptions: [{ value: 120, label: "2 hours" }],
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const timingGroup = container.querySelector('[data-testid="factory-launch-timing"]');
    const startDateInput = container.querySelector<HTMLInputElement>("#factory-start-date");
    const durationField = container.querySelector<HTMLSelectElement>("#factory-duration");

    expect(timingGroup?.className).toContain("space-y-4");
    expect(timingGroup?.className).not.toContain("grid");
    expect(startDateInput?.closest(".grid")?.querySelector("#factory-duration")).toBeNull();
    expect(durationField).not.toBeNull();
  });

  it("shows the three fixed blitz play style options", async () => {
    await act(async () => {
      root.render(<FactoryV2StartWorkspace {...buildProps()} />);
      await waitForAsyncWork();
    });

    const defaultButton = findPlayStyleButton(container, "Multiple Players, 3 Realms");
    const twoPlayerButton = findPlayStyleButton(container, "2 players, 3 Realms");
    const singleRealmButton = findPlayStyleButton(container, "Multiple Players, 1 Realm");

    expect(defaultButton?.getAttribute("aria-pressed")).toBe("true");
    expect(twoPlayerButton?.getAttribute("aria-pressed")).toBe("false");
    expect(singleRealmButton?.getAttribute("aria-pressed")).toBe("false");
  });

  it("hides the max player control while two-player mode is chosen", async () => {
    await act(async () => {
      root.render(<FactoryV2StartWorkspace {...buildProps({ twoPlayerMode: true })} />);
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Max players");
  });

  it("switches to the two-player play style from the default state", async () => {
    const onToggleTwoPlayerMode = vi.fn();
    const onToggleSingleRealmMode = vi.fn();

    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            onToggleTwoPlayerMode,
            onToggleSingleRealmMode,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const twoPlayerButton = findPlayStyleButton(container, "2 players, 3 Realms");

    await act(async () => {
      (twoPlayerButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onToggleTwoPlayerMode).toHaveBeenCalledTimes(1);
    expect(onToggleSingleRealmMode).not.toHaveBeenCalled();
  });
});

function findPlayStyleButton(container: HTMLDivElement, label: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")).find((button) =>
    button.textContent?.includes(label),
  );
}
