import React, { useState } from "react";
import type { ChatTab } from "../../model/types";
import { ReactComponent as CollapseIcon } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as ExpandIcon } from "@/assets/icons/common/expand.svg";

interface TabBarProps {
  tabs: ChatTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onAddDM: () => void;
  onSave: () => void;
  onMinimize: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onAddDM,
  onSave,
  onMinimize,
  onToggleExpand,
  isExpanded,
  className = "",
}) => {
  return (
    <div className={`flex items-center justify-between border-b border-gold/30 px-2 py-1 ${className}`}>
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        <button
          onClick={onAddDM}
          className="flex-shrink-0 px-2 py-1 text-xs text-gold/70 hover:text-gold hover:bg-gold/10 rounded transition-all duration-200 h-[26px] flex items-center"
          title="New DM"
        >
          + DM
        </button>

        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all duration-200 flex-shrink-0 h-[26px] ${
                  isActive
                    ? "bg-gold/20 text-gold"
                    : "text-gold/70 hover:text-gold hover:bg-gold/10"
                }`}
              >
                <button
                  onClick={() => onTabClick(tab.id)}
                  className="flex items-center gap-1"
                >
                  <span>{tab.label}</span>
                  {tab.unreadCount > 0 && (
                    <span className="animate-pulse bg-red-500 text-white text-xxs px-1.5 py-0.5 bg-red/30 rounded-full">
                      {tab.unreadCount}
                    </span>
                  )}
                </button>
                {tab.closeable !== false && (
                  <button
                    onClick={() => onTabClose(tab.id)}
                    className="ml-1 text-gold/50 hover:text-gold transition-colors text-2xl leading-none"
                    title="Close tab"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 border-l border-gold/30 pl-2">
        <button
          onClick={onSave}
          className="px-2 py-1 text-xs text-gold/70 hover:text-gold hover:bg-gold/10 rounded transition-all"
          title="Save chat to file"
        >
          💾
        </button>
        <button
          onClick={onToggleExpand}
          className="px-2 py-1 text-xs text-gold/70 hover:text-gold hover:bg-gold/10 rounded transition-all"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
        </button>
        <button
          onClick={onMinimize}
          className="px-2 py-1 text-xs text-gold/70 hover:text-gold hover:bg-gold/10 rounded transition-all"
          title="Minimize chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="w-4 h-4">
            <path d="M6 12L18 12" stroke="#E0AF65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
