import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useMemo } from "react";
import { Tab } from "./types";
import { useChatStore } from "./use-chat-store";

export const ChatTab = ({ tab, selected }: { tab: Tab; selected: boolean }) => {
  const setCurrentTab = useChatStore((state) => state.setCurrentTab);
  const hideTab = useChatStore((state) => state.hideTab);

  const userName = useMemo(() => {
    if (tab.name.length > 8) return `${tab.name.slice(0, 8)}...`;
    return tab.name;
  }, [tab]);

  const hasUnreadMessages = useMemo(() => {
    return tab.lastMessage && tab.lastSeen && new Date(tab.lastMessage).getTime() > new Date(tab.lastSeen).getTime();
  }, [tab.lastMessage, tab.lastSeen]);

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
          className={`text-sm px-1 py-0.5 text-center self-center rounded bg-hex-bg border border-gold/30 ${
            selected ? "bg-brown" : "bg-brown/60 text-gold/70"
          } flex flex-row gap-1 justify-between items-center relative`}
          style={{ zIndex: 2 }}
          onClick={() => setCurrentTab({ ...tab, displayed: true })}
        >
          <span className={hasUnreadMessages ? "animate-pulse text-red" : ""}>{userName}</span>

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
