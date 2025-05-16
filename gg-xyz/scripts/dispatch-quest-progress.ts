import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { dispatchGgXyzQuestProgress } from "../src/gg-xyz";
// Get the directory of the current script
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file in the script directory
config({ path: resolve(__dirname, ".env") });

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
      `[${new Date().toISOString()}] Processing events since: ${new Date(lastProcessedTimestamp * 1000).toISOString()}`,
    );

    // Process events and get the new latest timestamp in seconds
    const newTimestamp = await dispatchGgXyzQuestProgress(lastProcessedTimestamp);
    // Store the new timestamp
    storeLastProcessedTimestamp(newTimestamp);

    console.log(
      `[${new Date().toISOString()}] Events processed successfully up to: ${new Date(newTimestamp * 1000).toISOString()}`,
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in quest progress dispatch:`, error);
  }
}

// Run immediately on startup
processEvents();

// Then run every 10 seconds
const INTERVAL_MS = 10 * 1000; // 10 seconds
setInterval(processEvents, INTERVAL_MS);

console.log(
  `[${new Date().toISOString()}] Quest progress dispatcher started. Running every ${INTERVAL_MS / 1000} seconds.`,
);

// Handle process termination
process.on("SIGINT", () => {
  console.log(`[${new Date().toISOString()}] Quest progress dispatcher stopped.`);
  process.exit(0);
});
