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

  /**
   * Enhanced Windows installer with better error handling and logging
   */
  async runWindowsInstaller(scriptPath: string, args: string[] = [], verbose: boolean = true): Promise<void> {
    // First check PowerShell execution policy
    const policyCheckChild = spawn.spawn("powershell", ["-Command", "Get-ExecutionPolicy"]);

    let policy = "";
    policyCheckChild.stdout.on("data", (data) => {
      policy += data.toString().trim();
    });

    await new Promise<void>((resolve) => {
      policyCheckChild.on("close", () => resolve());
    });

    if (policy === "Restricted" || policy === "AllSigned") {
      console.warn("PowerShell execution policy is restrictive: " + policy);
      // We'll try to run with bypass flag
    }

    // Create a more robust PowerShell command
    const psArgs = ["-ExecutionPolicy", "Bypass", "-NoProfile", "-File", scriptPath, ...args];

    const child = spawn.spawn("powershell", psArgs);

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (data) => {
      const message = data.toString();
      stdoutData += message;
      if (verbose) console.log(`[Installer] ${message.trim()}`);
    });

    child.stderr.on("data", (data) => {
      const message = data.toString();
      stderrData += message;
      console.error(`[Installer Error] ${message.trim()}`);
    });

    return new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Provide detailed error information
          const error = new Error(
            `Installation failed with code ${code}.\nStdout: ${stdoutData}\nStderr: ${stderrData}`,
          );
          console.error(error.message);
          reject(error);
        }
      });
    });
  },

  /**
   * Try to run a process with administrator privileges on Windows
   * Note: This will prompt the user with a UAC dialog
   */
  async runAsAdmin(command: string, args: string[]): Promise<void> {
    if (!this.isWindows()) {
      return this.runCommand(command, args);
    }

    const psArgs = ["-Command", `Start-Process "${command}" -ArgumentList "${args.join(" ")}" -Verb RunAs -Wait`];

    const child = spawn.spawn("powershell", psArgs);

    return new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Failed to run as admin with code ${code}`));
      });
    });
  },
};
