import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { dispatchGgXyzQuestProgress } from "../src/gg-xyz";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Get the directory of the current script
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the script directory
config({ path: resolve(__dirname, ".env") });

// Validate required environment variables
const requiredEnvVars = [
  "PUBLIC_TORII",
  "PUBLIC_ACTION_DISPATCHER_URL",
  "PUBLIC_ACTION_DISPATCHER_SECRET",
  "LAST_PROCESSED_TIMESTAMP",
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`${colors.red}${colors.bright}❌ Missing required environment variables:${colors.reset}`);
  missingEnvVars.forEach((varName) => {
    console.error(`${colors.red}  - ${varName}${colors.reset}`);
  });
  throw new Error("Missing required environment variables");
}

// Get the last processed timestamp from environment variable or use 0
// timestamp is in seconds
const getLastProcessedTimestamp = (): number => {
  const timestamp = process.env.LAST_PROCESSED_TIMESTAMP;
  return timestamp ? parseInt(timestamp, 10) : 0;
};

// Store the timestamp in environment variable
// timestamp is in seconds
const storeLastProcessedTimestamp = (timestamp: number): void => {
  process.env.LAST_PROCESSED_TIMESTAMP = timestamp.toString();
};

async function processEvents() {
  try {
    // Get the last processed timestamp
    const lastProcessedTimestamp = getLastProcessedTimestamp();
    console.log(
      `${colors.cyan}${colors.bright}🕒 [${new Date().toISOString()}] Processing events since: ${colors.reset}${colors.dim}${new Date(lastProcessedTimestamp * 1000).toISOString()}${colors.reset}`,
    );

    // Process events and get the new latest timestamp in seconds
    const newTimestamp = await dispatchGgXyzQuestProgress(lastProcessedTimestamp);
    // Store the new timestamp
    storeLastProcessedTimestamp(newTimestamp);

    console.log(
      `${colors.green}${colors.bright}✅ [${new Date().toISOString()}] Events processed successfully up to: ${colors.reset}${colors.dim}${new Date(newTimestamp * 1000).toISOString()}${colors.reset}`,
    );
  } catch (error) {
    console.error(
      `${colors.red}${colors.bright}❌ [${new Date().toISOString()}] Error in quest progress dispatch:${colors.reset}`,
      error,
    );
  }
}

// Run immediately on startup
processEvents();

// Then run every 10 seconds
const INTERVAL_MS = 10 * 1000; // 10 seconds
setInterval(processEvents, INTERVAL_MS);

console.log(
  `${colors.magenta}${colors.bright}🚀 [${new Date().toISOString()}] Quest progress dispatcher started. Running every ${INTERVAL_MS / 1000} seconds.${colors.reset}`,
);

// Handle process termination
process.on("SIGINT", () => {
  console.log(
    `${colors.yellow}${colors.bright}👋 [${new Date().toISOString()}] Quest progress dispatcher stopped.${colors.reset}`,
  );
  process.exit(0);
});
