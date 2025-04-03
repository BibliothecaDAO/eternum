import cover1 from "@public/covers/01.png";
import cover02 from "@public/covers/02.png";
import cover03 from "@public/covers/03.png";
import cover04 from "@public/covers/04.png";
import cover05 from "@public/covers/05.png";
import cover06 from "@public/covers/06.png";
import cover07 from "@public/covers/07.png";

// import Refresh from "@public/icons/refresh.svg?react";
import { useEffect, useMemo } from "react";
import styled from "styled-components";
import { ToriiConfig } from "../types";
import { DeleteButton } from "./components/delete";
import { Logs } from "./components/logs";
import { Warning } from "./components/warning";
import { Page, useAppContext } from "./context";
import { useProgress } from "./hooks/use-progress";
import { ErrorPage } from "./pages/error-page";
import { StartPage } from "./pages/start-page";
import { SyncingPage } from "./pages/syncing-page";

const DraggableArea = styled.div`
  -webkit-app-region: drag;
  width: 100vw;
  min-height: 30px;
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  padding: 4px 6px 4px 6px;
`;

const ClickableArea = styled.div`
  -webkit-app-region: no-drag;
`;

export const Launcher = () => {
  const { setCurrentConfig, page, progress, reset, setProgress, setReset } = useAppContext();

  useProgress();

  useEffect(() => {
    if (reset) {
      setProgress(0);
      setReset(false);
    }
  }, [reset, setProgress, setReset]);

  const backgroundImage = useMemo(() => {
    const img = getRandomBackgroundImage();
    return img;
  }, []);

  useEffect(() => {
    const removeListener = window.electronAPI.onConfigChanged((config: ToriiConfig) => {
      console.log("config changed", config);
      setCurrentConfig(config);
    });
    return () => {
      removeListener();
    };
  }, []);

  return (
    <>
      <img className="z-1 absolute h-screen w-screen object-cover" src={`${backgroundImage}`} alt="Cover" />
      <div className="relative top-0 left-0 right-0 bottom-0 w-[100vw] h-[100vh] overflow-hidden flex flex-col justify-center items-center z-20">
        <DraggableArea className="h-fit flex flex-row justify-between items-center">
          <div className="text-white text-xs">Eternum Launcher</div>
          {page === Page.Syncing && (
            <ClickableArea className="flex flex-row gap-4 items-center justify-center">
              <DeleteButton />
              <div className="text-white text-xs select-none">{Math.ceil(progress)}%</div>
            </ClickableArea>
          )}
        </DraggableArea>

        <div className="relative flex flex-col h-full justify-center items-center transition-all duration-300 ease-in-out">
          {page === Page.Start ? <StartPage /> : page === Page.Syncing ? <SyncingPage /> : <ErrorPage />}
        </div>
        <Warning />
        <Logs />
      </div>
    </>
  );
};

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
