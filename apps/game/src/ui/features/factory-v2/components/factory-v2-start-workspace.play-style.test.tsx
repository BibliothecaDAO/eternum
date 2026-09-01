import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFactoryMoreOptionsDraft } from "../map-options";
import { createFactoryBiomeClimateDraft } from "../biome-climate-options";
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

vi.mock("./factory-v2-deployer-wallet-card", () => ({
  FactoryV2DeployerWalletCard: () => <div>Deployer wallet</div>,
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
  environmentLabel: "Appchain",
  launchTargetKind: "game",
  presets: [createPreset()],
  selectedPreset: createPreset(),
  gameName: "bltz-sprint-01",
  seriesName: "bltz-weekend-cup",
  rotationName: "bltz-ladder-loop",
  startAt: "2026-03-18T12:00",
  durationMinutes: null,
  seriesGameCount: 3,
  seriesGames: [
    { id: "series-1", gameName: "bltz-weekend-cup-01", startAt: "2026-03-18T12:00", seriesGameNumber: 1 },
    { id: "series-2", gameName: "bltz-weekend-cup-02", startAt: "2026-03-18T12:00", seriesGameNumber: 2 },
    { id: "series-3", gameName: "bltz-weekend-cup-03", startAt: "2026-03-18T12:00", seriesGameNumber: 3 },
  ],
  rotationPreviewGames: [
    { id: "rotation-1", gameName: "bltz-ladder-loop-01", startAt: "2026-03-18T12:00", seriesGameNumber: 1 },
    { id: "rotation-2", gameName: "bltz-ladder-loop-02", startAt: "2026-03-18T13:00", seriesGameNumber: 2 },
  ],
  rotationGameIntervalMinutes: 60,
  rotationMaxGames: 12,
  rotationAdvanceWindowGames: 5,
  rotationEvaluationIntervalMinutes: 15,
  autoRetryIntervalMinutes: 15,
  showsDuration: false,
  durationOptions: [],
  twoPlayerMode: false,
  singleRealmMode: false,
  seriesSuggestions: [],
  isLoadingSeries: false,
  seriesLookupError: null,
  existingRunName: null,
  notice: null,
  moreOptionSections: [],
  moreOptionDraft: createFactoryMoreOptionsDraft("blitz", "appchain"),
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
  biomeClimateDraft: createFactoryBiomeClimateDraft("appchain", "blitz"),
  biomeClimateErrors: {
    elevationScaleBps: null,
    moistureScaleBps: null,
    elevationBiasBps: null,
    moistureBiasBps: null,
    elevationSeed: null,
    moistureSeed: null,
  },
  biomeClimateTargets: [{ id: "game", label: "bltz-sprint-01" }],
  selectedBiomeClimateTargetId: "game",
  biomeClimateDisabledReason: null,
  onSelectLaunchTargetKind: vi.fn(),
  onSelectPreset: vi.fn(),
  onGameNameChange: vi.fn(),
  onSeriesNameChange: vi.fn(),
  onRotationNameChange: vi.fn(),
  onStartAtChange: vi.fn(),
  onDurationChange: vi.fn(),
  onSeriesGameCountChange: vi.fn(),
  onSeriesGameNameChange: vi.fn(),
  onSeriesGameStartAtChange: vi.fn(),
  onRotationGameIntervalMinutesChange: vi.fn(),
  onRotationMaxGamesChange: vi.fn(),
  onRotationAdvanceWindowGamesChange: vi.fn(),
  onRotationEvaluationIntervalChange: vi.fn(),
  onAutoRetryIntervalChange: vi.fn(),
  onSelectSeriesSuggestion: vi.fn(),
  onMapOptionValueChange: vi.fn(),
  onSelectBiomeClimateTarget: vi.fn(),
  onBiomeClimateValueChange: vi.fn(),
  onRandomizeBiomeClimateSeeds: vi.fn(),
  onResetBiomeClimate: vi.fn(),
  onApplyBiomeClimateToAll: vi.fn(),
  onToggleTwoPlayerMode: vi.fn(),
  onToggleSingleRealmMode: vi.fn(),
  onFandomizeGameName: vi.fn(),
  chain: "appchain",
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

  it("keeps the default path to preset, name, start time and launch", async () => {
    await act(async () => {
      root.render(<FactoryV2StartWorkspace {...buildProps()} />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Launch basics");
    expect(container.querySelector("#factory-preset")).not.toBeNull();
    expect(container.querySelector("#factory-game-name")).not.toBeNull();
    expect(container.querySelector("#factory-start-date")).not.toBeNull();
    expect(container.querySelector('[data-testid="factory-launch-button"]')).not.toBeNull();
    expect(container.textContent).toContain("Advanced");
    expect(container.textContent).not.toContain("Launch type");
    expect(container.textContent).not.toContain("Blitz setup");
    expect(container.textContent).not.toContain("Biome tuning");
    expect(container.textContent).not.toContain("Max players");
  });

  it("reveals launch type, blitz setup and map tuning behind Advanced", async () => {
    await act(async () => {
      root.render(<FactoryV2StartWorkspace {...buildProps()} />);
      await waitForAsyncWork();
    });

    await openAdvanced(container);

    expect(container.textContent).toContain("Launch type");
    expect(container.textContent).toContain("Blitz setup");
    expect(container.textContent).toContain("Biome tuning");
    expect(container.textContent).toContain("Max players");
    expect(container.textContent).toContain("More options");
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
    const startDateDisplay = container.querySelector('[data-testid="factory-start-date-display"]');
    const startTimeDisplay = container.querySelector('[data-testid="factory-start-time-display"]');
    const launchGrid = startDateInput?.closest(".grid");
    const startDatePanel = startDateInput?.closest("label");
    const startTimePanel = startTimeInput?.closest("label");

    expect(container.querySelector("#factory-start-at")).toBeNull();
    expect(startDateInput?.className).toContain("min-w-0");
    expect(startDateInput?.className).toContain("max-w-full");
    expect(startDateInput?.className).toContain("absolute");
    expect(startDateInput?.className).toContain("opacity-0");
    expect(startTimeInput?.className).toContain("min-w-0");
    expect(startTimeInput?.className).toContain("max-w-full");
    expect(startTimeInput?.className).toContain("absolute");
    expect(startTimeInput?.className).toContain("opacity-0");
    expect(startDateDisplay?.className).toContain("px-4");
    expect(startDateDisplay?.className).toContain("gap-3");
    expect(startTimeDisplay?.className).toContain("px-4");
    expect(startTimeDisplay?.className).toContain("gap-3");
    expect(launchGrid?.className).toContain("min-w-0");
    expect(launchGrid?.className).toContain("sm:grid-cols-2");
    expect(startDatePanel?.className).toContain("rounded-[20px]");
    expect(startDatePanel?.className).toContain("overflow-hidden");
    expect(startTimePanel?.className).toContain("rounded-[20px]");
    expect(startTimePanel?.className).toContain("overflow-hidden");
  });

  it("restores visible native date and time inputs on desktop", async () => {
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
    const startDateDisplay = container.querySelector('[data-testid="factory-start-date-display"]');
    const startTimeDisplay = container.querySelector('[data-testid="factory-start-time-display"]');

    expect(startDateInput?.className).toContain("sm:static");
    expect(startDateInput?.className).toContain("sm:opacity-100");
    expect(startDateInput?.className).toContain("sm:border");
    expect(startTimeInput?.className).toContain("sm:static");
    expect(startTimeInput?.className).toContain("sm:opacity-100");
    expect(startTimeInput?.className).toContain("sm:border");
    expect(startDateDisplay?.className).toContain("sm:hidden");
    expect(startTimeDisplay?.className).toContain("sm:hidden");
  });

  it("keeps the duration override out of the schedule row and behind Advanced", async () => {
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

    expect(container.querySelector("#factory-duration")).toBeNull();

    await openAdvanced(container);

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

    await openAdvanced(container);

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

    await openAdvanced(container);

    expect(container.textContent).toContain("Blitz setup");
    expect(container.textContent).not.toContain("Max players");
  });

  it("shows per-game biome controls for series launches and can apply one climate to all games", async () => {
    const onApplyBiomeClimateToAll = vi.fn();

    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            launchTargetKind: "series",
            biomeClimateTargets: [
              { id: "series-1", label: "1. bltz-weekend-cup-01" },
              { id: "series-2", label: "2. bltz-weekend-cup-02" },
            ],
            selectedBiomeClimateTargetId: "series-1",
            onApplyBiomeClimateToAll,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    await openAdvanced(container);

    expect(container.textContent).toContain("Biome tuning");
    expect(container.textContent).toContain("Apply to all");

    const applyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Apply to all"),
    );

    await act(async () => {
      (applyButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onApplyBiomeClimateToAll).toHaveBeenCalledTimes(1);
  });

  it("disables launch when biome climate values need review", async () => {
    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            biomeClimateDisabledReason: "Elevation scale BPS must be an integer between 0 and 65535.",
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const launchButton = container.querySelector<HTMLButtonElement>('[data-testid="factory-launch-button"]');

    expect(launchButton?.disabled).toBe(true);
    expect(container.textContent).toContain("Needs review");

    await openAdvanced(container);

    expect(container.textContent).toContain("Elevation scale BPS must be an integer between 0 and 65535.");
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

    await openAdvanced(container);

    const twoPlayerButton = findPlayStyleButton(container, "2 players, 3 Realms");

    await act(async () => {
      (twoPlayerButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onToggleTwoPlayerMode).toHaveBeenCalledTimes(1);
    expect(onToggleSingleRealmMode).not.toHaveBeenCalled();
  });

  it("keeps series launches enabled when a parent series run already exists", async () => {
    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            launchTargetKind: "series",
            existingRunName: "bltz-weekend-cup",
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const launchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim().includes("Launch 3-game series on Appchain"),
    );

    expect(launchButton).toBeDefined();
    expect(launchButton?.hasAttribute("disabled")).toBe(false);
    expect(container.textContent).toContain("append any new games and resume that shared run");
    expect(container.textContent).toContain("Only used after a failed step.");
    expect(container.textContent).toContain("This is how long the launcher waits before trying that game again.");
  });

  it("shows rotation controls and a queued preview when rotation is selected", async () => {
    await act(async () => {
      root.render(
        <FactoryV2StartWorkspace
          {...buildProps({
            launchTargetKind: "rotation",
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Rotation basics");
    expect(container.textContent).toContain("Rotation preview");
    expect(container.textContent).toContain("Max games");
    expect(container.textContent).toContain("Keep ahead");
    expect(container.textContent).toContain("Game interval");
    expect(container.textContent).toContain("Evaluate every");
    expect(container.textContent).toContain(
      "How often the rotation checks whether it needs to queue more games ahead.",
    );
    expect(container.textContent).toContain("Only used after a failed step.");
    expect(container.textContent).toContain("bltz-ladder-loop-01");
    expect(container.textContent).toContain("bltz-ladder-loop-02");
  });
});

async function openAdvanced(container: HTMLDivElement) {
  const toggle = container.querySelector<HTMLButtonElement>('[data-testid="factory-advanced-toggle"]');

  await act(async () => {
    (toggle as HTMLButtonElement).click();
    await waitForAsyncWork();
  });
}

function findPlayStyleButton(container: HTMLDivElement, label: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")).find((button) =>
    button.textContent?.includes(label),
  );
}
