import * as fsPromises from "fs/promises";
import tomlJson from "toml-json/dist";
import { APP_PATH } from "../constants";
import { ConfigType, ToriiConfig } from "../types";
import {
  getDbPath,
  getNetworkPath,
  getSettingsFilePath,
  getToriiTomlConfigPath,
  osUtils,
  warningLog,
} from "./os-utils";
import { getToriiConfig } from "./torii";

export const loadConfig = async (): Promise<ToriiConfig> => {
  let configType: ConfigType | null = null;
  try {
    configType = await getSavedConfigType();
  } catch (e) {
    // if the settings file doesn't exist, we need to create the file and set the default rpc
    configType = getDefaultConfigType();
    await saveConfigType(configType);
  }

  const config = await getToriiConfig(configType);

  const configPath = getToriiTomlConfigPath(configType);
  await osUtils.removeDirectory(configPath);
  await osUtils.ensureDirectoryExists(getNetworkPath(configType));
  await fsPromises.writeFile(configPath, config);

  const configJson = tomlJson({ data: config });
  return {
    configType,
    rpc: (configJson as any).rpc,
    world_address: (configJson as any).world_address,
    world_block: (configJson as any).indexing.world_block,
  };
};

export async function getSavedConfigType(): Promise<ConfigType> {
  const settings = await fsPromises.readFile(getSettingsFilePath(), "utf8");
  const settingsJson = JSON.parse(settings);
  return settingsJson.configType;
}

export const saveConfigType = async (configType: ConfigType) => {
  await osUtils.ensureDirectoryExists(APP_PATH);

  const settingsFilePath = getSettingsFilePath();
  const exists = await osUtils.fileExists(settingsFilePath);

  if (!exists) {
    warningLog("Settings file does not exist, creating...");
    await fsPromises.writeFile(settingsFilePath, JSON.stringify({}));
  }

  const settings = await fsPromises.readFile(settingsFilePath, "utf8");

  const settingsJson = JSON.parse(settings);
  settingsJson.configType = configType;

  await fsPromises.writeFile(settingsFilePath, JSON.stringify(settingsJson));
};

export const getDefaultConfig = async () => {
  const configType = await getDefaultConfigType();
  return {
    configType,
    dbPath: getDbPath(configType),
  };
};

export function getDefaultConfigType(): ConfigType {
  return "mainnet";
}
