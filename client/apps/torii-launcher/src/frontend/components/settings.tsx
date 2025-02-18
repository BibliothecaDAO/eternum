import { useEffect, useState } from "react";
import { CurrentRpc, Rpc } from "../../types";
import Button from "../utils/button";

export const Settings = ({
  showSettings,
  currentRpc,
  setNewRpc,
}: {
  showSettings: boolean;
  currentRpc: CurrentRpc | null;
  setNewRpc: (rpc: CurrentRpc) => void;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedRpc, setSelectedRpc] = useState<CurrentRpc | null>(currentRpc);

  useEffect(() => {
    if (showSettings) {
      // Trigger reflow to ensure transition works
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [showSettings]);

  return (
    <div
      className={`flex flex-col justify-start items-center max-h-full
		transition-all duration-300 ease-in-out p-4
		${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
    >
      <div className="flex flex-col justify-start items-center rounded-md text-xs text-gold">
        <p className="text-center text-[12px]">This will reset Torii and will restart the sync</p>
        <div className="flex flex-col gap-1 mt-2 rounded-md items-start text-gold">
          <CheckBox checked={selectedRpc?.name === "Mainnet"} label="Mainnet" setSelectedRpc={setSelectedRpc} />
          <CheckBox checked={selectedRpc?.name === "Sepolia"} label="Sepolia" setSelectedRpc={setSelectedRpc} />
          <CheckBox checked={selectedRpc?.name === "Localhost"} label="Localhost" setSelectedRpc={setSelectedRpc} />
          <CustomCheckBox checked={selectedRpc?.name === "Custom"} label="Custom" setSelectedRpc={setSelectedRpc} />
        </div>
      </div>
      <Button
        className="mt-3 !h-6 !bg-gold hover:!bg-gold/70 text-brown transition-all duration-300 ease-in-out hover:!scale-102 !text-xs"
        onClick={() => {
          setNewRpc(selectedRpc);
        }}
      >
        Confirm
      </Button>
    </div>
  );
};

const CheckBox = ({
  checked,
  label,
  setSelectedRpc,
}: {
  checked: boolean;
  label: string;
  setSelectedRpc: (rpc: CurrentRpc) => void;
}) => {
  return (
    <div
      onClick={() => {
        setSelectedRpc(Rpc[label as keyof typeof Rpc]);
      }}
      className="flex flex-row justify-center items-center gap-2 rounded-md"
    >
      <input
        type="radio"
        className="transition-all duration-300 ease-in-out w-3 h-3 bg-grey/40 appearance-none inline-block checked:bg-gold/60 checked:border-0 rounded-full checked:border-2 checked:border-gold/20"
        checked={checked}
        onChange={() => {
          setSelectedRpc(Rpc[label as keyof typeof Rpc]);
        }}
      />
      <label className="">{label}</label>
    </div>
  );
};

const CustomCheckBox = ({
  checked,
  label,
  setSelectedRpc,
}: {
  checked: boolean;
  label: string;
  setSelectedRpc: (rpc: CurrentRpc) => void;
}) => {
  const [customUrl, setCustomUrl] = useState("");

  return (
    <div className="flex flex-col">
      <div
        className="flex flex-row items-center gap-2 rounded-md"
        onClick={() => {
          setSelectedRpc({ name: label, url: customUrl, worldBlock: 0 });
        }}
      >
        <input
          type="radio"
          className="transition-all duration-300 ease-in-out w-3 h-3 bg-grey/40 appearance-none inline-block checked:bg-gold/60 checked:border-0 rounded-full checked:border-2 checked:border-gold/20"
          checked={checked}
          onChange={() => {
            setSelectedRpc({ name: label, url: customUrl, worldBlock: 0 });
          }}
        />
        <label className="">{label}</label>
      </div>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: checked ? "2rem" : "0" }}
      >
        <input
          type="text"
          value={customUrl}
          onChange={(e) => {
            setCustomUrl(e.target.value);
            setSelectedRpc({ name: label, url: e.target.value, worldBlock: 0 });
          }}
          onFocus={() => {
            setSelectedRpc({ name: label, url: customUrl, worldBlock: 0 });
          }}
          placeholder="Enter custom RPC URL"
          className="mt-1 transition-all duration-300 ease-in-out max-w-24 w-24 px-2 py-1 rounded-md outline-none border-0 bg-transparent focus:border-0 focus:outline-none focus:ring-0"
        />
      </div>
    </div>
  );
};
