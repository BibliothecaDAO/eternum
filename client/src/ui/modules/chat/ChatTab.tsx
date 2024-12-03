import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useMemo } from "react";
import { useChatStore } from "./ChatState";
import { GLOBAL_CHANNEL, GLOBAL_CHANNEL_KEY } from "./constants";

export const DEFAULT_TAB: Tab = {
  name: GLOBAL_CHANNEL_KEY,
  address: "0x0",
  key: GLOBAL_CHANNEL,
  displayed: true,
  lastSeen: new Date(),
  mandatory: true,
};

export const EVENT_STREAM_TAB: Tab = {
  name: "Events",
  address: "0x1",
  key: "events",
  displayed: true,
  lastSeen: new Date(),
  mandatory: true,
};

export interface Tab {
  name: string;
  key: string;
  address: string;
  numberOfMessages?: number;
  displayed: boolean;
  lastSeen: Date;
  mandatory?: boolean;
}

export const ChatTab = ({ tab, selected }: { tab: Tab; selected: boolean }) => {
  const setCurrentTab = useChatStore((state) => state.setCurrentTab);
  const hideTab = useChatStore((state) => state.hideTab);

  const userName = useMemo(() => {
    if (tab.name.length > 8) return `${tab.name.slice(0, 8)}...`;
    return tab.name;
  }, [tab]);

  return (
    <AnimatePresence>
      <motion.div
        className="relative flex flex-grow"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className={`text-sm px-2 py-1 text-center self-center rounded bg-hex-bg border border-gold/30 ${
            selected ? "bg-brown/70" : "bg-brown/10"
          } flex flex-row gap-2 justify-between items-center relative h-8`}
          style={{ zIndex: 2 }}
          onClick={() => setCurrentTab({ ...tab, displayed: true })}
        >
          <span>{userName}</span>

          <div className="w-4 flex items-center justify-center">
            {(tab.mandatory === undefined || tab.mandatory === false) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hideTab({ ...tab, displayed: false });
                }}
                className="hover:bg-brown/40 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
