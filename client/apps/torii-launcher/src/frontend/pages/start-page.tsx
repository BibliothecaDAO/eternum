import { useEffect, useState } from "react";
import { CONFIG_TYPES, IpcMethod } from "../../types";
import { ButtonLike } from "../components/button-like";
import { Dropdown } from "../components/dropdown";
import { ProgressLogo } from "../components/progress-logo";
import { Page, useAppContext } from "../context";
import { capitalize } from "../utils";

export const StartPage = () => {
  const { setPage } = useAppContext();

  const [selectedConfig, setSelectedConfig] = useState<string>(capitalize(CONFIG_TYPES[0]));

  useEffect(() => {
    window.electronAPI.onConfigChanged((config) => {
      setSelectedConfig(capitalize(config.configType));
    });
  }, []);

  return (
    <div className="flex flex-col justify-center items-center gap-[10px]">
      <ProgressLogo />
      <div className="text-white text-base font-bold uppercase select-none">Download Eternum Data</div>
      <div className="flex flex-row gap-2">
        <Dropdown
          options={CONFIG_TYPES.map((config) => capitalize(config))}
          selectCallback={(option) => setSelectedConfig(option)}
        />
        <ButtonLike
          onClick={() => {
            window.electronAPI.sendMessage(IpcMethod.StartTorii, selectedConfig.toLowerCase());
            setPage(Page.Syncing);
          }}
          className="bg-[#000000]/50  hover:bg-[#ffffff]/10"
        >
          <div>Sync</div>
        </ButtonLike>
      </div>
    </div>
  );
};
