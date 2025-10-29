import { useCallback, useMemo, useState } from "react";
import type { Chain } from "@contracts";
import { env } from "../../../env";
import { buildWorldProfile } from "@/runtime/world/profile-builder";
import {
  getActiveWorld,
  getActiveWorldName,
  listWorldNames,
  saveWorldProfile,
  setActiveWorldName,
} from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";

export type WorldGateState = {
  status: "pending" | "ready";
  fallback?: React.ReactNode;
};

export const useWorldGate = (): WorldGateState => {
  const chain = env.VITE_PUBLIC_CHAIN as Chain;
  const active = getActiveWorld();
  const activeName = getActiveWorldName();

  const [name, setName] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [changing, setChanging] = useState(false);

  const saved = useMemo(() => listWorldNames(), []);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const ok = await isToriiAvailable(`https://api.cartridge.gg/x/${name}/torii`);
      setAvailable(ok);
    } finally {
      setChecking(false);
    }
  }, [name]);

  const confirmUse = useCallback(
    async (chosen: string) => {
      // Build/refresh profile to ensure addresses are up-to-date
      const profile = await buildWorldProfile(chain, chosen);
      setActiveWorldName(chosen);
      saveWorldProfile(profile);
      // Trigger ready by returning no fallback
      setChanging(true); // just to force re-render until usePlayFlow re-evaluates world gate
    },
    [chain],
  );

  if (active) {
    return {
      status: "ready",
    };
  }

  const UI = (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0f0f0f] p-6 text-white">
      <div className="w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Select World</h2>

        {activeName ? (
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 text-sm text-slate-300">Previously selected world:</div>
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm text-slate-200">{activeName}</div>
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white"
                  onClick={() => confirmUse(activeName)}
                >
                  Use
                </button>
                <button
                  className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => setChanging(true)}
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {(changing || !activeName) && (
          <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900 p-4">
            {saved.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {saved.map((s) => (
                  <button
                    key={s}
                    onClick={() => setName(s)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      name === s ? "border-blue-400 bg-blue-500/10" : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <label className="text-xs text-slate-400">World name</label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-sm outline-none focus:border-slate-500"
              placeholder="username-12345"
              value={name}
              onChange={(e) => setName(e.target.value.trim())}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleCheck}
                className="rounded-md border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
              >
                Check Torii
              </button>
              {checking && <span className="text-xs text-slate-400">Checking…</span>}
              {available === true && <span className="text-xs text-emerald-400">Available</span>}
              {available === false && <span className="text-xs text-red-400">Not reachable</span>}
            </div>

            <div className="flex justify-end">
              <button
                disabled={!name}
                onClick={() => confirmUse(name)}
                className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white disabled:bg-slate-700"
              >
                Use World
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return {
    status: "pending",
    fallback: UI,
  };
};
