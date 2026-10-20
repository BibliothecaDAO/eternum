import { useEffect, useRef, useState } from "react";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RELIC_PACKS } from "@bibliothecadao/types";
import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import type { ChestOpening } from "@/hooks/store/use-chest-opening-store";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { ChestTileDetails } from "@/ui/features/world/components/actions/chest-tile-details";
import { openRelicCrate } from "@/ui/features/military/chest/open-relic-crate";
import {
  chestStudyGame,
  holdChestStudyClock,
  INITIAL_PACK,
  openFixtureChest,
  setChestPack,
  resetRewardChest,
  expireRewardChest,
  type ChestStudyPack,
} from "./fixture";
import { mountChestProof, type ChestProofScene } from "./scene";

export function RelicChestLab() {
  useDocumentClass("classic-hud");
  const [frontier] = useState(() => new URLSearchParams(location.search).get("gameMode") === "frontier");
  const [store] = useState(() => chestStudyGame(frontier));
  const [pack, setPack] = useState(INITIAL_PACK);
  const [focused, setFocused] = useState(false);
  const [opening, setOpening] = useState<ChestOpening | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => (frontier ? holdChestStudyClock() : undefined), [frontier]);
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<ChestProofScene | null>(null);
  useEffect(() => {
    const setup = { store } as GameClientSetup;
    return new WorldUpdateListener(setup).Chests.onChestOpened((result) => {
      setOpening(result);
      scene.current?.open(result);
    });
  }, [store]);
  useEffect(() => {
    setReady(false);
    setError("");
    if (!showMap) return;
    const abort = new AbortController();
    let mounted: ChestProofScene | null = null;
    void mountChestProof(container.current!, abort.signal, () => setFocused(true))
      .then((handle) => {
        mounted = handle;
        if (abort.signal.aborted) return handle.dispose();
        scene.current = handle;
        setReady(true);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(String(reason));
      });
    return () => {
      abort.abort();
      mounted?.dispose();
      scene.current = null;
    };
  }, [showMap]);
  const reset = (next = pack) => {
    setPack(next);
    if (frontier) resetRewardChest(store);
    else setChestPack(store, next);
    setOpening(null);
    setFocused(false);
    scene.current?.reset();
  };
  const open = () => {
    if (opening || !ready) return;
    return openRelicCrate({
      account: { address: "0x111" } as never,
      systemCalls: { open_chest: async () => openFixtureChest(store, pack, frontier) } as never,
      explorerId: 70,
      hex: { col: 0, row: 0 },
    });
  };
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
      <main
        className="ui h-full overflow-auto bg-hud-surface p-5 text-hud-ink"
        data-hud-mode={frontier ? "frontier" : "blitz"}
        data-relic-chest-lab
        data-ready={ready}
      >
        <header className="mb-3 flex flex-wrap items-center gap-4" data-lab-chrome>
          <div className="flex-1">
            <h1 className="text-hud-title">{frontier ? "Frontier reward chest" : "Relic chest · reveal on opening"}</h1>
            <p>
              Production appearance and panel. Click the chest or its held-open hover plate to focus it. Local fixture;
              no transaction.
            </p>
          </div>
          {!frontier && (
            <>
              <label>
                Fixture pack{" "}
                <select
                  aria-label="Fixture pack"
                  className="bg-black p-1"
                  value={pack.pack}
                  onChange={(event) => reset({ ...pack, pack: event.target.value as ChestStudyPack["pack"] })}
                >
                  {Object.keys(RELIC_PACKS).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={pack.lucky}
                  onChange={(event) => reset({ ...pack, lucky: event.target.checked })}
                />{" "}
                Lucky · level II
              </label>
            </>
          )}
          {frontier && (
            <HudButton kind="secondary" onClick={expireRewardChest}>
              Advance to day rollover
            </HudButton>
          )}
          <HudButton kind="secondary" onClick={() => reset()}>
            Reset chest
          </HudButton>
          <HudButton
            kind="quiet"
            onClick={() => {
              setShowMap(!showMap);
              setFocused(false);
              setOpening(null);
            }}
          >
            {showMap ? "Close 3D proof" : "Open 3D proof"}
          </HudButton>
        </header>
        {showMap && (
          <div
            className="relative my-2 h-[380px] overflow-hidden rounded border border-hud-line"
            ref={container}
            aria-label="Production relic chest on native terrain"
          />
        )}
        {showMap && (!ready || error) && <p role="status">{error || "Loading native terrain and chest…"}</p>}
        <section className="max-w-md" data-chest-panel>
          {focused ? (
            <ChestTileDetails
              coordsLabel="Chest tile · 0,0"
              rewardChestId={frontier && !opening ? 9 : undefined}
              opening={opening}
              onOpen={open}
            />
          ) : (
            <p>Focus the chest to inspect its tile.</p>
          )}
        </section>
      </main>
    </GameProvider>
  );
}
