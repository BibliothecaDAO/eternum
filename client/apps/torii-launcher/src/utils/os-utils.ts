import { ChildProcessWithoutNullStreams } from "child_process";
import * as spawn from "cross-spawn";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";

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
   * Download a file from URL with enhanced logging and error handling
   */
  async downloadFile(url: string, destination: string, verbose: boolean = true): Promise<void> {
    if (this.isWindows()) {
      if (verbose) console.log(`[Download] Attempting to download from ${url} to ${destination}`);

      // First check if we can access the URL
      const checkUrlChild = spawn.spawn("powershell", [
        "-Command",
        `try { 
          $response = Invoke-WebRequest -Uri "${url}" -Method Head -UseBasicParsing -ErrorAction Stop;
          Write-Output "URL accessible: $($response.StatusCode)";
        } catch {
          Write-Error "URL check failed: $_";
          exit 1;
        }`,
      ]);

      let urlCheckOutput = "";
      let urlCheckError = "";

      checkUrlChild.stdout.on("data", (data) => {
        urlCheckOutput += data.toString();
        if (verbose) console.log(`[URL Check] ${data.toString().trim()}`);
      });

      checkUrlChild.stderr.on("data", (data) => {
        urlCheckError += data.toString();
        console.error(`[URL Check Error] ${data.toString().trim()}`);
      });

      try {
        await new Promise<void>((resolve, reject) => {
          checkUrlChild.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`URL check failed with code ${code}: ${urlCheckError}`));
          });
        });
      } catch (e) {
        console.error(`[Download] URL validation failed: ${e.message}`);
        throw new Error(`Cannot access URL ${url}: ${e.message}`);
      }

      // Ensure the destination directory exists
      const dirPath = path.dirname(destination);
      try {
        await fsPromises.mkdir(dirPath, { recursive: true });
        if (verbose) console.log(`[Download] Ensured directory exists: ${dirPath}`);
      } catch (e) {
        console.error(`[Download] Failed to create directory: ${e.message}`);
        throw new Error(`Cannot create directory ${dirPath}: ${e.message}`);
      }

      // Check write permissions
      try {
        const testFilePath = path.join(dirPath, "test-write-permissions.txt");
        await fsPromises.writeFile(testFilePath, "test");
        await fsPromises.unlink(testFilePath);
        if (verbose) console.log(`[Download] Write permissions verified for ${dirPath}`);
      } catch (e) {
        console.error(`[Download] No write permissions: ${e.message}`);
        throw new Error(`No write permissions for ${dirPath}: ${e.message}`);
      }

      // Now attempt the actual download
      if (verbose) console.log(`[Download] Starting download with PowerShell...`);

      const downloadCommand = `
        try {
          $ProgressPreference = 'SilentlyContinue'  # Disable progress bar for better performance
          Invoke-WebRequest -Uri "${url}" -OutFile "${destination}" -UseBasicParsing -ErrorAction Stop
          if (Test-Path "${destination}") {
            $fileSize = (Get-Item "${destination}").Length
            Write-Output "Download completed. File size: $fileSize bytes"
            exit 0
          } else {
            Write-Error "File was not created"
            exit 1
          }
        } catch {
          Write-Error "Download failed: $_"
          exit 1
        }
      `;

      const child = spawn.spawn("powershell", ["-Command", downloadCommand]);

      let stdoutData = "";
      let stderrData = "";

      child.stdout.on("data", (data) => {
        const message = data.toString();
        stdoutData += message;
        if (verbose) console.log(`[Download] ${message.trim()}`);
      });

      child.stderr.on("data", (data) => {
        const message = data.toString();
        stderrData += message;
        console.error(`[Download Error] ${message.trim()}`);
      });

      return new Promise<void>((resolve, reject) => {
        child.on("close", (code) => {
          if (code === 0) {
            if (verbose) console.log(`[Download] Successfully downloaded file to ${destination}`);
            resolve();
          } else {
            const error = new Error(`Download failed with code ${code}.\nStdout: ${stdoutData}\nStderr: ${stderrData}`);
            console.error(`[Download] ${error.message}`);
            reject(error);
          }
        });
      });
    } else {
      // Unix-based download using curl with better logging
      console.log(`[Download] Downloading from ${url} to ${destination} using curl`);

      const child = spawn.spawn("curl", ["-L", url, "-o", destination, "--fail"]);

      let stdoutData = "";
      let stderrData = "";

      child.stdout.on("data", (data) => {
        const message = data.toString();
        stdoutData += message;
        if (verbose) console.log(`[curl] ${message.trim()}`);
      });

      child.stderr.on("data", (data) => {
        const message = data.toString();
        stderrData += message;
        // curl sends progress to stderr, so we don't treat this as an error
        if (verbose) console.log(`[curl] ${message.trim()}`);
      });

      return new Promise<void>((resolve, reject) => {
        child.on("close", (code) => {
          if (code === 0) {
            console.log(`[Download] Successfully downloaded file to ${destination}`);
            resolve();
          } else {
            const error = new Error(`Download failed with code ${code}.\nStdout: ${stdoutData}\nStderr: ${stderrData}`);
            console.error(`[Download] ${error.message}`);
            reject(error);
          }
        });
      });
    }
  },

  /**
   * Try alternative download methods if the primary method fails
   */
  async downloadFileWithFallback(url: string, destination: string): Promise<void> {
    try {
      // Try the primary download method first
      await this.downloadFile(url, destination);
    } catch (primaryError) {
      console.warn(`[Download] Primary download method failed: ${primaryError.message}`);
      console.log(`[Download] Trying alternative download method...`);

      if (this.isWindows()) {
        // Try with System.Net.WebClient which has different security handling
        const fallbackCommand = `
          try {
            $client = New-Object System.Net.WebClient
            $client.DownloadFile("${url}", "${destination}")
            if (Test-Path "${destination}") {
              Write-Output "Alternative download completed"
              exit 0
            } else {
              Write-Error "Alternative download failed - file not created"
              exit 1
            }
          } catch {
            Write-Error "Alternative download failed: $_"
            exit 1
          }
        `;

        const child = spawn.spawn("powershell", ["-Command", fallbackCommand]);

        let stdoutData = "";
        let stderrData = "";

        child.stdout.on("data", (data) => {
          stdoutData += data.toString();
          console.log(`[Alt Download] ${data.toString().trim()}`);
        });

        child.stderr.on("data", (data) => {
          stderrData += data.toString();
          console.error(`[Alt Download Error] ${data.toString().trim()}`);
        });

        try {
          await new Promise<void>((resolve, reject) => {
            child.on("close", (code) => {
              if (code === 0) {
                console.log(`[Download] Alternative download succeeded`);
                resolve();
              } else {
                reject(
                  new Error(
                    `Alternative download failed with code ${code}.\nStdout: ${stdoutData}\nStderr: ${stderrData}`,
                  ),
                );
              }
            });
          });
        } catch (fallbackError) {
          console.error(`[Download] All download methods failed`);
          console.error(`- Primary error: ${primaryError.message}`);
          console.error(`- Fallback error: ${fallbackError.message}`);
          throw new Error(`Failed to download ${url}: All methods failed`);
        }
      } else {
        // Try wget as a fallback on Unix systems
        try {
          console.log(`[Download] Trying wget as fallback...`);
          const wgetChild = spawn.spawn("wget", [url, "-O", destination]);

          await new Promise<void>((resolve, reject) => {
            wgetChild.on("close", (code) => {
              if (code === 0) resolve();
              else reject(new Error(`wget download failed with code ${code}`));
            });
          });
        } catch (wgetError) {
          console.error(`[Download] All download methods failed`);
          throw new Error(`Failed to download ${url}: All methods failed`);
        }
      }
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
