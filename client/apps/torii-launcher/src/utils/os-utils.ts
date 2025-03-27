import * as spawn from "cross-spawn";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { APP_PATH } from "../constants";
import { ConfigType } from "../types";

/**
 * Utility functions for handling OS-specific operations
 */
export const osUtils = {
  /**
   * Determines if the current platform is Windows
   */
  isWindows(): boolean {
    return process.platform === "win32";
  },

  /**
   * Gets the correct executable name based on platform
   */
  getExecutableName(baseName: string): string {
    return this.isWindows() ? `${baseName}.exe` : baseName;
  },

  /**
   * Remove a directory recursively in a platform-specific way
   */
  async removeDirectory(dirPath: string): Promise<void> {
    if (this.isWindows()) {
      // Windows way to remove a directory recursively
      spawn.sync("powershell", [
        "-Command",
        `Remove-Item -Path "${dirPath}" -Recurse -Force -ErrorAction SilentlyContinue`,
      ]);
    } else {
      // Unix way
      spawn.sync("rm", ["-rf", dirPath]);
    }
  },

  /**
   * Create directory if it doesn't exist
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    await fsPromises.mkdir(dirPath, { recursive: true });
  },

  /**
   * Check if a file or directory exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    return fsPromises
      .access(filePath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  },
};

export const getNetworkPath = (configType: ConfigType) => {
  return path.join(APP_PATH, configType.toLowerCase());
};

export const getDbPath = (configType: ConfigType) => {
  const dbPath = path.join(getNetworkPath(configType), "torii-db");
  return dbPath;
};

export const getToriiTomlConfigPath = (configType: ConfigType) => {
  return path.join(getNetworkPath(configType), "torii.toml");
};

export const getSettingsFilePath = () => {
  return path.join(APP_PATH, "settings.json");
};

export const getStateFilePath = (configType: ConfigType) => {
  return path.join(getNetworkPath(configType), "state.json");
};

const fontYellow = "\x1b[33m";
const fontReset = "\x1b[0m";
const fontRed = "\x1b[31m";
const fontNormal = "\x1b[34m";

export const warningLog = (message: string) => {
  console.warn(`${fontYellow}${message}${fontReset}`);
};

export const errorLog = (message: string) => {
  console.error(`${fontRed}${message}${fontReset}`);
};

export const normalLog = (message: string) => {
  console.log(`${fontNormal}${message}${fontReset}`);
};
