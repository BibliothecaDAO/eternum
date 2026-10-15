import { iconUrl } from "@/ui/design-system/icon-meaning";
import { StructureRealmActionsView } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { HudChatTrigger } from "@/ui/features/world/containers/hud-chat-window";
import { useLayoutEffect, useState } from "react";
import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import type { LeftListFilter } from "@/hooks/store/use-ui-store";
import type { RealmPresetId } from "@bibliothecadao/eternum/automation";
import { ArenaHudView } from "@/ui/features/world/containers/arena-hud-view";
import { StructureListColumnView } from "@/ui/features/world/containers/left-facets/structure-list-column";
import { EmpireCockpitView } from "@/ui/features/world/containers/left-facets/empire-cockpit";
import { ResourceToken } from "@/ui/features/world/containers/left-facets/resource-token";
import { StructureActionsPanelView } from "@/ui/features/world/containers/left-facets/structure-actions-panel";
import { isStructureActionEnabled } from "@/ui/features/world/containers/left-facets/use-structure-actions";
import { NextSuggestionView } from "@/ui/features/world/containers/left-facets/next-suggestion";
import { AutomationPresetSwitchView } from "@/ui/features/settlement/production/automation-preset-switch";
import { HudEventsView } from "@/ui/features/event-feed/hud-events";
import { FeedRowLineView } from "@/ui/features/event-feed/feed-row-line";
import { SelectedTileSummaryView } from "@/ui/features/world/containers/selected-tile-summary";
import { PaintedMinimapView } from "@/ui/features/world/components/bottom-right-panel/painted-minimap";
import { HudHeaderLayout } from "@/ui/features/world/containers/top-header/hud-header-layout";
import { IdentityChipView } from "@/ui/features/world/containers/top-header/identity-chip";
import { GameClockView } from "@/ui/features/world/containers/top-header/game-clock";
import { resolveGameClock } from "@/ui/features/world/containers/top-header/game-clock-policy";
import { resolveDayPhase } from "@/utils/cycle-progress";
import { MapViewControls } from "@/ui/features/world/containers/top-header/map-view-controls";
import { SettingsButton } from "@/ui/features/world/containers/secondary-menu-items";
import { categoryPaintings } from "@/ui/design-system/painted/hud-art";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import {
  minimapTiles,
  actionChoices,
  currentStructure,
  fixtureCommands,
  makeStructures,
  resources,
  troopFixtures,
  viewNames,
} from "./fixtures";
import { CurrentHudReference } from "./current-hud-reference";
import { readVisibleUnits } from "./sample.mjs";
import "./hud-scene.css";

type Props = {
  camera: { hex: { col: number; row: number }; distance: number };
  layout?: "rails" | "current";
  count?: number;
  density?: string;
  placement?: string;
  names?: readonly [string, string];
  onReadout?: (groups: { group: string; elements: string[] }[]) => void;
};
export function HudScene(props: Props) {
  const { onReadout } = props;
  useLayoutEffect(() => {
    const host = document.querySelector(".hud-lab-stage")!;
    const update = () => onReadout?.(readVisibleUnits());
    const observer = new MutationObserver(update);
    observer.observe(host, { childList: true, subtree: true, attributes: true });
    host.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      host.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [onReadout]);
  return props.layout === "current" ? <CurrentHudReference {...props} /> : <FixtureArenaHud {...props} />;
}

/** Fixtures provide facts and preview callbacks; all HUD presentation belongs to the game. */
function FixtureArenaHud({ count = 3, density = "rows", placement = "center", names = viewNames[0], camera }: Props) {
  const structures = makeStructures(count).map(currentStructure);
  const [selectedId, select] = useState(3);
  const selected = structures.find((row) => row.entityId === selectedId) ?? structures[0];
  const [filter, setFilter] = useState<LeftListFilter>("all");
  const [preset, setPreset] = useState<RealmPresetId>("smart");
  const [local, setLocal] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [scouted, setScouted] = useState(false);
  const lane = useCompactLane();
  const commands = fixtureCommands(count);
  return (
    <>
      <ArenaHudView
        placement={placement}
        header={
          <HudHeaderLayout
            lane={lane}
            attention={null}
            identity={
              <IdentityChipView
                state={{
                  kind: "player",
                  name: "uxplay",
                  realmCount: structures.filter((row) => row.category === 1).length,
                  standing: { rank: 1, points: 5 },
                }}
                isOpen={false}
                compact={!!lane}
                onClick={() => setModal("Standings")}
              />
            }
            clock={
              <GameClockView
                clock={resolveGameClock({
                  startAt: 1000,
                  endAt: 4600,
                  now: 2103,
                  armyTickSeconds: 60,
                  gameOver: false,
                })}
                dayPhase={resolveDayPhase(48)}
                armyTickSeconds={60}
                compact={!!lane}
              />
            }
            viewControls={
              <MapViewControls
                names={names}
                compact={!!lane}
                isLocalView={local}
                canOpenLocal
                mapLayer={false}
                showLayerSwitch={false}
                onNavigate={(world) => setLocal(!world)}
                onLayerChange={() => {}}
              />
            }
            settings={<SettingsButton onClick={() => setModal("Settings")} />}
          />
        }
        structures={
          <StructureListColumnView
            structures={structures}
            selectedId={selected.entityId}
            filterValue={filter}
            onFilterChange={setFilter}
            onSelect={select}
            density={density}
            renderActions={(id) => {
              const level = structures.find((row) => row.entityId === id)!.realmLevel;
              const nextName = ["Settlement", "City", "Kingdom", "Empire"][level + 1];
              return (
                <StructureRealmActionsView
                  step={{
                    mode: "level-up",
                    word: `Level up to ${nextName}`,
                    ready: true,
                    loading: false,
                    refusal: null,
                    currentLevel: level,
                    nextLevel: level + 1,
                    nextLevelName: nextName,
                    requirements: [],
                    run: () => setModal(`Level up to ${nextName}`),
                  }}
                />
              );
            }}
          />
        }
        realm={
          <EmpireCockpitView
            title={`${selected.displayName} · ${selected.originalName === "" ? "Structure" : makeStructures(count).find((row) => row.id === selected.entityId)?.kind}`}
            cue={<AutomationPresetSwitchView value={preset} onChange={setPreset} />}
          >
            <div className="resource-grid simple">
              {resources.map((resource) => (
                <ResourceToken
                  key={resource.name}
                  label={resource.name}
                  amount={resource.held}
                  buildings={String(resource.buildings)}
                  producing={preset !== "idle" && resource.producing}
                  seconds={resource.seconds}
                  detail={`${resource.name}: ${resource.held} owned · ${resource.buildings} buildings · ${resource.rate}`}
                />
              ))}
            </div>
          </EmpireCockpitView>
        }
        suggestion={
          <NextSuggestionView
            title={`${selected.displayName} can level up`}
            label="Level up to City"
            onClick={() => setModal("Level up to City")}
          />
        }
        events={
          <HudEventsView>
            <FeedRowLineView
              icon={<img src={iconUrl("explore")} alt="" />}
              text="Scouts found grassland"
              time="1m"
              onClick={() => {
                setScouted(true);
                setLocal(false);
              }}
            />
            <FeedRowLineView
              icon={<img src={iconUrl("donkey")} alt="" />}
              text="Transfer reached Stolsli"
              time="3m"
              onClick={() => setModal("Transfer arrived")}
            />
          </HudEventsView>
        }
        tile={
          <SelectedTileSummaryView
            title={`${scouted ? "Northern grassland" : selected.displayName} · (12, 8)`}
            description={`Grassland · ${scouted ? "Unoccupied" : "Your structure"}`}
            art={scouted ? iconUrl("explore") : categoryPaintings[selected.category].art}
            details={<p>Selected tile fixture · {selected.displayName}</p>}
          />
        }
        minimap={
          <PaintedMinimapView
            tiles={minimapTiles.map((tile) => ({
              ...tile,
              ...(tile.occupier_id === "501"
                ? { ownerCue: "ally" as const, strength: 80 }
                : tile.occupier_id === "999"
                  ? { strength: 120 }
                  : {}),
            }))}
            mapCenter={0}
            cameraDistance={camera.distance}
            cameraTargetHex={camera.hex}
            selectedHex={{ col: 9, row: 6 }}
            navigationTarget={null}
            ownedStructureIds={new Set(["1", "2", "3"])}
            ownedExplorerIds={new Set()}
          />
        }
        commands={
          <StructureActionsPanelView
            actions={actionChoices
              .filter((action) => isStructureActionEnabled(action.id, (command) => commands.has(command)))
              .map((action) => ({
                id: action.id,
                label: action.word,
                active: false,
                refusal: null,
                onClick: () => setModal(action.word),
              }))}
          />
        }
        chat={
          <div className="hud-chat-host" data-group="Chat">
            <HudChatTrigger open={false} compact stripText="No messages yet" onClick={() => setModal("Chat")} />
          </div>
        }
        log={
          <button className="hud-log" data-group="Log" data-notice onClick={() => setModal("Event log")}>
            Log
          </button>
        }
      />
      {modal && (
        <Sheet label={modal} onClose={() => setModal(null)}>
          <h2>{modal}</h2>
          <p>{selected.displayName} · fixture preview</p>
          {/Transfer/i.test(modal) && <img src={iconUrl("donkey")} alt="Pack donkey" width={64} />}
          {/Production|Military/i.test(modal) && (
            <>
              <div className="resource-grid simple troop-grid">
                {troopFixtures.map((troop) => (
                  <ResourceToken
                    key={troop.resource}
                    label={troop.resource}
                    amount={String(troop.held)}
                    detail={`${troop.label}: ${troop.held} held`}
                    producing={false}
                    seconds={0}
                  />
                ))}
              </div>
              <ul>
                {troopFixtures.map((troop) => (
                  <li key={troop.army}>
                    <TroopChip
                      troops={{
                        category: troop.label.split(" ")[0] as TroopType,
                        tier: troop.label.split(" ")[1] as TroopTier,
                        count: BigInt(troop.held) * 1_000_000_000n,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <p>This fixture previews the panel. Game commands use their live handlers.</p>
          <button onClick={() => setModal(null)}>Back to map</button>
        </Sheet>
      )}
    </>
  );
}
