import Close from "@public/icons/close.svg?react";
import Error from "@public/icons/error.svg?react";
import Info from "@public/icons/info.svg?react";
import List from "@public/icons/list.svg?react";
import { useEffect, useState } from "react";
import { Notification, NotificationType } from "../../types";
import { Page, useAppContext } from "../context";

export const Logs = () => {
  const { page } = useAppContext();

  const [unseenLogsCount, setUnseenLogsCount] = useState(0);
  const [logs, setLogs] = useState<Notification[]>([]);

  const [showLogsPanel, setShowLogsPanel] = useState(false);

  useEffect(() => {
    const removeListener = window.electronAPI.onNotification((notification: Notification) => {
      console.log("Notification received: " + JSON.stringify(notification));
      setLogs((prevLogs) => [notification, ...prevLogs]);
      setUnseenLogsCount((prev) => prev + 1);
    });

    return () => {
      removeListener();
    };
  }, []);

  const toggleLogsPanel = () => {
    setShowLogsPanel(!showLogsPanel);
    if (showLogsPanel) {
      setUnseenLogsCount(0);
    }
  };

  return (
    page === Page.Syncing && (
      <div
        className={`${showLogsPanel ? "translate-y-0" : "translate-y-[calc(100%-32px)]"} fixed bottom-0 w-full h-[90vh] transform transition-transform duration-300 ease-in-out z-30 flex flex-col items-end`}
      >
        <button
          onClick={toggleLogsPanel}
          className={`w-fit min-w-[60px] h-[32px] relative flex items-center justify-center text-xs bg-white/50 p-2 rounded-tl gap-2 cursor-pointer ${!showLogsPanel ? "hover:bg-white/90" : ""} transition-all duration-300 ease-in-out`}
        >
          {showLogsPanel ? (
            <Close
              className={`w-4 h-4 fill-black ${showLogsPanel ? "opacity-100" : "opacity-0 w-0 h-0 pointer-events-none"}`}
            />
          ) : (
            <List
              className={`w-4 h-4 fill-black ${!showLogsPanel ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            />
          )}
          <div
            className={`w-full text-black text-xs select-none ${!showLogsPanel ? "opacity-100" : "opacity-0 hidden pointer-events-none"}`}
          >
            ({unseenLogsCount}) Logs
          </div>
        </button>

        <div className="flex flex-col w-full h-full p-2 gap-2 bg-white/50 backdrop-blur-sm">
          <div className="text-xs">Logs</div>
          <div className="flex flex-col overflow-y-auto gap-1 no-scrollbar">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`flex justify-between items-center rounded-sm text-base border-l-2 py-1 pl-3 pr-2 gap-2 ${
                  log.type === NotificationType.Error
                    ? "bg-deepRed/10 text-deepRed/60 border-l-deepRed/60"
                    : "bg-black/10 text-similiBlack border-l-similiBlack"
                }`}
              >
                <div className="flex items-center gap-2">
                  {log.type === NotificationType.Info && (
                    <Info className="w-[16px] h-[16px] fill-black flex-shrink-0" />
                  )}
                  {log.type === NotificationType.Error && <Error className="w-[16px] h-[16px] flex-shrink-0" />}
                  {log.message}
                </div>
                <div className="text-xs text-[#515151]/70">{new Date(log.timestampMs).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  );
};
