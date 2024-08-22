import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import { World } from "./ui/layouts/World";

import { ConfigManager, EternumConfig } from "@bibliothecadao/eternum";
import * as fs from "fs";

function App() {
  const configPath = "../config/EternumConfig.json";

  let configData: Partial<EternumConfig> = {};
  try {
    const rawData = fs.readFileSync(configPath, "utf-8");
    if (rawData.trim()) {
      configData = JSON.parse(rawData);
    }
  } catch (error) {
    console.warn(`Failed to load config: ${error}`);
  }

  ConfigManager.instance(configData);

  return (
    <>
      <ToastContainer style={{ zIndex: 1100 }} />
      <World />
    </>
  );
}

export default App;
