import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import React, { useState } from "react";
import type { ChatTab } from "../../model/types";
import { HudChip } from "@/ui/design-system/kit/hud-elements";

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
  showWindowControls?: boolean;
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
  showWindowControls = true,
}) => {
  return (
    <div className={`flex items-center justify-between border-b border-hud-line px-2 py-1 ${className}`}>
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        <button
          onClick={onAddDM}
          className="flex-shrink-0 px-2 py-1 text-hud-label text-hud-muted hover:text-hud-accent hover:bg-hud-hover rounded transition-all duration-200 h-7 max-lg:h-11 flex items-center"
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
                className={`flex items-center gap-1 px-2 py-1 rounded text-hud-label transition-all duration-200 flex-shrink-0 h-7 max-lg:h-11 ${
                  isActive ? "bg-hud-chosen text-hud-accent" : "text-hud-muted hover:text-hud-accent hover:bg-hud-hover"
                }`}
              >
                <button onClick={() => onTabClick(tab.id)} className="flex items-center gap-1 max-lg:h-11">
                  <span>{tab.label}</span>
                  {tab.unreadCount > 0 && (
                    <span className="animate-pulse">
                      <HudChip tone="bad">{tab.unreadCount}</HudChip>
                    </span>
                  )}
                </button>
                {tab.closeable !== false && (
                  <button
                    onClick={() => onTabClose(tab.id)}
                    className="ml-1 text-hud-cue hover:text-hud-accent transition-colors text-hud-display leading-none max-lg:flex max-lg:h-11 max-lg:w-8 max-lg:items-center max-lg:justify-center"
                    title="Close tab"
                  >
                    <SemanticIcon name="close" className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 border-l border-hud-line pl-2">
        <button
          onClick={onSave}
          className="px-2 py-1 text-hud-label text-hud-muted hover:text-hud-accent hover:bg-hud-hover rounded transition-all max-lg:min-h-11 max-lg:min-w-11"
          title="Save chat to file"
        >
          💾
        </button>
        {showWindowControls && (
          <>
            <button
              onClick={onToggleExpand}
              className="px-2 py-1 text-hud-label text-hud-muted hover:text-hud-accent hover:bg-hud-hover rounded transition-all"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <SemanticIcon name="collapse" className="w-4 h-4" />
              ) : (
                <SemanticIcon name="expand" className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onMinimize}
              className="px-2 py-1 text-hud-label text-hud-muted hover:text-hud-accent hover:bg-hud-hover rounded transition-all"
              title="Minimize chat"
            >
              <SemanticIcon name="minus" className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
