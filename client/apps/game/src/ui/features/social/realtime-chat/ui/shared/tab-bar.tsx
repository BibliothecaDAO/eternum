import React, { useState } from "react";
import type { ChatTab } from "../../model/types";

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
          className="flex-shrink-0 px-2 py-1 text-xs text-gold/70 hover:text-gold hover:bg-gold/10 rounded transition-all duration-200 border border-gold/30"
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
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all duration-200 flex-shrink-0 ${
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
                <button
                  onClick={() => onTabClose(tab.id)}
                  className="ml-1 text-gold/50 hover:text-gold transition-colors"
                  title="Close tab"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onSave}
          className="px-2 py-1 text-xs text-gold/70 hover:text-gold transition-colors"
          title="Save chat"
        >
          Save
        </button>
        <button
          onClick={onMinimize}
          className="px-2 py-1 text-xs text-gold/70 hover:text-gold transition-colors"
          title="Minimize"
        >
          −
        </button>
        <button
          onClick={onToggleExpand}
          className="px-2 py-1 text-xs text-gold/70 hover:text-gold transition-colors"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          ↕
        </button>
      </div>
    </div>
  );
};
