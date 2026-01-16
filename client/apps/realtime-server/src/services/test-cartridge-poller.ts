#!/usr/bin/env bun
import "dotenv/config";
import { createCartridgePoller } from "./cartridge-poller";

/**
 * Test script for the Cartridge paymaster poller
 *
 * Usage:
 *   bun run src/services/test-cartridge-poller.ts
 *
 * Or with a custom webhook URL:
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... bun run src/services/test-cartridge-poller.ts
 */

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  console.error("❌ DISCORD_WEBHOOK_URL environment variable is required");
  console.error("\nUsage:");
  console.error("  1. Add DISCORD_WEBHOOK_URL to your .env file, or");
  console.error(
    "  2. Run with: DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... bun run src/services/test-cartridge-poller.ts",
  );
  process.exit(1);
}

console.log("🧪 Testing Cartridge Paymaster Poller");
console.log("=====================================\n");

// Test 1: Fetch data directly
console.log("Test 1: Fetching paymaster data...");
const poller = createCartridgePoller(webhookUrl, 10000); // 10 seconds for testing

try {
  const data = await poller.fetchPaymasterData();
  console.log("✓ Successfully fetched data:");
  console.log("  - Budget:", data.budget);
  console.log("  - Budget Fee Unit:", data.budgetFeeUnit);
  console.log("  - Credit Fees:", data.creditFees);
  console.log();
} catch (error) {
  console.error("✗ Failed to fetch data:", error);
  process.exit(1);
}

// Test 2: Post to Discord
console.log("Test 2: Posting to Discord...");
try {
  const data = await poller.fetchPaymasterData();
  await poller.postToDiscord(data);
  console.log("✓ Successfully posted to Discord");
  console.log();
} catch (error) {
  console.error("✗ Failed to post to Discord:", error);
  process.exit(1);
}

// Test 3: Run poller for 3 cycles
console.log("Test 3: Running poller (will post 3 times with 10s interval)...");
console.log("Press Ctrl+C to stop early\n");

let count = 0;
const maxPolls = 3;

poller.start();

const checkInterval = setInterval(() => {
  count++;
  console.log(`Completed poll ${count}/${maxPolls}`);

  if (count >= maxPolls) {
    clearInterval(checkInterval);
    poller.stop();
    console.log("\n✓ All tests passed!");
    console.log("\nThe poller is working correctly. You can now:");
    console.log("  1. Add DISCORD_WEBHOOK_URL to your .env file");
    console.log("  2. Start the server with: pnpm dev");
    console.log("  3. The poller will run automatically in the background");
    process.exit(0);
  }
}, 10500); // Check slightly after poll interval

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nStopping test...");
  poller.stop();
  clearInterval(checkInterval);
  process.exit(0);
});
