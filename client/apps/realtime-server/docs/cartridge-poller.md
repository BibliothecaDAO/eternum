# Cartridge Paymaster Poller

This service polls the Cartridge GraphQL API for Empire paymaster status and posts updates to a Discord webhook.

## Features

- Polls the Cartridge API at configurable intervals
- Posts formatted status updates to Discord with embeds
- Tracks budget changes and highlights them
- Formats raw wei values into readable ETH amounts
- Automatic retry on failure (continues polling)

## Configuration

Add these environment variables to your `.env` file:

```bash
# Required: Discord webhook URL to post updates to
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# Optional: Poll interval in milliseconds (default: 300000 = 5 minutes)
CARTRIDGE_POLL_INTERVAL_MS=300000
```

## Discord Webhook Setup

1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Click "New Webhook"
4. Name it (e.g., "Empire Paymaster")
5. Select the channel where updates should be posted
6. Copy the webhook URL
7. Add it to your `.env` file as `DISCORD_WEBHOOK_URL`

## What Gets Posted

The Discord messages include:

- **Budget**: Formatted ETH value (converted from wei)
- **Fee Unit**: The token type (e.g., ETH, STRK)
- **Credit Fees**: Credit fee information
- **Raw Budget**: The raw wei value for reference
- **Timestamp**: When the data was fetched

Budget changes are highlighted with an orange color and warning indicator.

## Example Discord Output

```
🎮 Empire Paymaster Status
Current paymaster status

💰 Budget: 0.123456 ETH
🪙 Fee Unit: ETH
💳 Credit Fees: true
📊 Raw Budget: 123456000000000000

Timestamp: 2026-01-16T12:00:00.000Z
```

## API Details

The poller queries the Cartridge GraphQL API:

**Endpoint**: `https://api.cartridge.gg/query`

**Query**:
```graphql
{
  paymaster (name: "empire") {
    budget
    budgetFeeUnit
    creditFees
  }
}
```

## Running

The poller starts automatically when the server starts, if `DISCORD_WEBHOOK_URL` is configured:

```bash
pnpm dev
```

You'll see this in the logs:

```
Cartridge poller initialized (interval: 300s)
Polling Cartridge paymaster...
✓ Posted paymaster update to Discord
```

## Testing

To test without waiting for the interval, you can create a test script:

```typescript
import { createCartridgePoller } from "./src/services/cartridge-poller";

const poller = createCartridgePoller(
  "YOUR_DISCORD_WEBHOOK_URL",
  10000 // Poll every 10 seconds for testing
);

poller.start();

// Stop after 1 minute
setTimeout(() => {
  poller.stop();
  process.exit(0);
}, 60000);
```

## Error Handling

The poller includes error handling for:

- Failed API requests (logs error, continues polling)
- Failed Discord webhook posts (logs error, continues polling)
- Invalid response data (throws error)
- Network issues (logs error, continues polling)

Errors are logged to the console but don't stop the polling process.

## Stopping the Poller

The poller runs for the lifetime of the server process. To stop it programmatically:

```typescript
cartridgePoller.stop();
```

## Implementation Details

- Built with native `fetch` API (no external HTTP libraries needed)
- Uses `setInterval` for polling
- Tracks last budget value to detect changes
- Converts wei to ETH using BigInt for precision
- Discord embeds use color coding (green = normal, orange = budget changed)
