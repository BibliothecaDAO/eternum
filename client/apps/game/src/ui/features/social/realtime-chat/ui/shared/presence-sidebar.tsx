import { useMemo } from "react";

import { useRealtimePresence } from "../../hooks/use-realtime-chat";
import type { PlayerPresence } from "../../model/types";

const formatLastSeen = (lastSeen?: string | null) => {
  if (!lastSeen) return "Active now";
  const date = new Date(lastSeen);
  if (Number.isNaN(date.getTime())) return "Active recently";
  return `Active ${date.toLocaleTimeString()}`;
};

interface PresenceSidebarProps {
  onSelectPlayer?(player: PlayerPresence): void;
  className?: string;
}

export function PresenceSidebar({ onSelectPlayer, className }: PresenceSidebarProps) {
  const presence = useRealtimePresence();

  const { online, offline } = useMemo(() => {
    const onlinePlayers = presence.filter((player) => player.isOnline);
    const offlinePlayers = presence.filter((player) => !player.isOnline);
    return {
      online: onlinePlayers,
      offline: offlinePlayers,
    };
  }, [presence]);

  return (
    <aside className={`flex h-full flex-col gap-4 border-l border-neutral-800 bg-neutral-950 p-4 ${className ?? ""}`}>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Online</h3>
        <ul className="mt-2 space-y-1">
          {online.length === 0 && <li className="text-xs text-neutral-600">No players online.</li>}
          {online.map((player) => (
            <li key={player.playerId}>
              <button
                onClick={() => onSelectPlayer?.(player)}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm text-neutral-100 hover:bg-neutral-800"
              >
                <span>{player.displayName ?? player.playerId}</span>
                <span className="text-[10px] uppercase tracking-wide text-emerald-400">Online</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Recently Active</h3>
        <ul className="mt-2 space-y-1">
          {offline.length === 0 && <li className="text-xs text-neutral-600">No recent players.</li>}
          {offline.map((player) => (
            <li key={player.playerId}>
              <button
                onClick={() => onSelectPlayer?.(player)}
                className="flex w-full flex-col rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-neutral-800"
              >
                <span>{player.displayName ?? player.playerId}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  {formatLastSeen(player.lastSeenAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
