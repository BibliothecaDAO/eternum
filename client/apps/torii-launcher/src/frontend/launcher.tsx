import cover1 from "@public/covers/01.png";
import cover02 from "@public/covers/02.png";
import cover03 from "@public/covers/03.png";
import cover04 from "@public/covers/04.png";
import cover05 from "@public/covers/05.png";
import cover06 from "@public/covers/06.png";
import cover07 from "@public/covers/07.png";

import EternumLogo from "@public/eternum-new.svg?react";
import Refresh from "@public/icons/refresh.svg?react";
import SettingsIcon from "@public/icons/settings.svg?react";
import TrashCan from "@public/icons/trashcan.svg?react";
import XMark from "@public/icons/x-mark.svg?react";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { ConfigType, IpcMethod, ToriiConfig } from "../types";
import { Settings } from "./components/settings";
import { SyncingState } from "./components/syncing-state";
import { Warning } from "./components/warning";

export const Launcher = () => {
  const [reset, setReset] = useState(false);
  const [showWarning, setShowWarning] = useState<{
    method: IpcMethod;
    alertMessage: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ToriiConfig | null>(null);
  const [newConfig, setNewConfig] = useState<ConfigType | null>(null);

  const backgroundImage = useMemo(() => {
    const img = getRandomBackgroundImage();
    return img;
  }, []);

  useEffect(() => {
    const sub = window.electronAPI.onMessage(IpcMethod.ConfigWasChanged, (config: ToriiConfig) => {
      setCurrentConfig(config);
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (newConfig) {
      window.electronAPI.sendMessage(IpcMethod.ChangeConfigType, newConfig);
      //   setCurrentConfig(newConfig);
    }
  }, [newConfig]);

  const DraggableArea = styled.div`
    -webkit-app-region: drag;
    width: 100vw;
    min-height: 30px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999;
  `;

  return (
    <>
      <img className="z-1 absolute h-screen w-screen object-cover" src={`${backgroundImage}`} alt="Cover" />
      <div className="relative top-0 left-0 right-0 bottom-0 w-[100vw] h-[100vh] overflow-hidden flex flex-col justify-center items-center z-100">
        <DraggableArea />
        {!showSettings && currentConfig && (
          <div className="flex flex-row justify-center items-center gap-4 w-6 h-6 z-1000 fixed top-6 left-6">
            <SettingsIcon
              onClick={() => {
                setShowSettings(true);
              }}
              className="w-4 h-4 fill-gold z-index-1000 transition-all duration-300 ease-in-out hover:scale-125"
            />
          </div>
        )}

        <div className="flex flex-col justify-center items-center max-w-[50vw] bg-black/20 self-center border-[0.5px] border-gradient rounded-lg p-4 text-gold w-full overflow-hidden relative z-0 backdrop-filter backdrop-blur-[24px] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] transition-all duration-300 ease-in-out">
          {showWarning ? (
            <Warning setReset={setReset} showWarning={showWarning} setShowWarning={setShowWarning} />
          ) : (
            <>
              <EternumLogo className="w-16 h-16 fill-gold mb-4" />
              <SyncingState reset={reset} />
              <div className="flex flex-row items-center gap-4 mt-4">
                <Refresh
                  className="hover:bg-brown/10 w-3 h-3 fill-gold transition-all duration-300 ease-in-out hover:scale-125"
                  onClick={() =>
                    setShowWarning({
                      method: IpcMethod.KillTorii,
                      alertMessage: killToriiAlertMessage,
                    })
                  }
                />
                <TrashCan
                  className="hover:bg-brown/10 fill-red w-3 h-3 transition-all duration-300 ease-in-out hover:scale-125"
                  onClick={() =>
                    setShowWarning({
                      method: IpcMethod.ResetDatabase,
                      alertMessage: resetDatabaseAlertMessage,
                    })
                  }
                />
              </div>
            </>
          )}
        </div>

        {showSettings && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center">
            <img className="absolute h-screen w-screen object-cover" src={`${backgroundImage}`} alt="Cover" />
            <div className="absolute top-6 left-6 z-[1000]">
              <XMark
                onClick={() => {
                  setShowSettings(false);
                }}
                className="w-4 h-4 fill-gold transition-all duration-300 ease-in-out hover:scale-125"
              />
            </div>
            <div className="relative z-10 flex flex-col justify-center items-center max-w-[50vw] bg-black/20 self-center border-[0.5px] border-gradient rounded-lg p-4 text-gold w-full backdrop-filter backdrop-blur-[24px] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]">
              <Settings showSettings={showSettings} currentConfig={currentConfig} setNewConfig={setNewConfig} />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const resetDatabaseAlertMessage =
  "Careful, this will reset the database and restart the syncing process from the beginning.";
const killToriiAlertMessage = "Careful, if you are in the process of syncing, this could cause issues with the data";

export const getRandomBackgroundImage = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const imageNumber = (timestamp % 7) + 1;

  switch (imageNumber) {
    case 1:
      return cover1;
    case 2:
      return cover02;
    case 3:
      return cover03;
    case 4:
      return cover04;
    case 5:
      return cover05;
    case 6:
      return cover06;
    case 7:
      return cover07;
    default:
      return cover1;
  }
};
