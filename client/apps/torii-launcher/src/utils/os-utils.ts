import { ChildProcessWithoutNullStreams } from "child_process";
import * as spawn from "cross-spawn";
import * as fs from "fs";
import * as fsPromises from "fs/promises";

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
   * Run a command with platform-specific adjustments
   */
  runCommand(command: string, args: string[]): ChildProcessWithoutNullStreams {
    return spawn.spawn(command, args);
  },

  /**
   * Download a file from URL in a platform-specific way
   */
  async downloadFile(url: string, destination: string): Promise<void> {
    if (this.isWindows()) {
      const child = spawn.spawn("powershell", [
        "-Command",
        `Invoke-WebRequest -Uri "${url}" -OutFile "${destination}"`,
      ]);

      return new Promise<void>((resolve, reject) => {
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Failed to download file with code ${code}`));
        });
      });
    } else {
      // Unix-based download using curl
      const child = spawn.spawn("curl", ["-L", url, "-o", destination]);

      return new Promise<void>((resolve, reject) => {
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Failed to download file with code ${code}`));
        });
      });
    }
  },

  /**
   * Install a package using platform-specific method
   */
  async runInstaller(scriptPath: string, args: string[] = []): Promise<void> {
    let child;

    if (this.isWindows()) {
      child = spawn.spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args]);
    } else {
      child = spawn.spawn("sh", [scriptPath, ...args]);
    }

    return new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Installation failed with code ${code}`));
      });
    });
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
