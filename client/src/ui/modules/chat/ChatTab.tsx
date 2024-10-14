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
};

export interface Tab {
  name: string;
  key: string;
  address: string;
  numberOfMessages?: number;
  displayed: boolean;
  lastSeen: Date;
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
          className={`text-sm px-2 text-center self-center rounded bg-hex-bg border border-gold/30 ${
            selected ? "bg-black/70" : "bg-black/10"
          } flex flex-row gap-2 justify-between items-center relative`}
          style={{ zIndex: 2 }}
          onClick={() => setCurrentTab({ ...tab, displayed: true })}
        >
          <span>{userName}</span>

          <div>
            {tab.name !== GLOBAL_CHANNEL_KEY && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hideTab({ ...tab, displayed: false });
                }}
                className="hover:bg-black/40 rounded-full"
              >
                <X className="w-2" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
