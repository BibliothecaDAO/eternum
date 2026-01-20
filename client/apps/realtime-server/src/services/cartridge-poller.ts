interface PaymasterData {
  budget: string;
  budgetFeeUnit: string;
  creditFees: string;
}

interface PaymasterResponse {
  data: {
    paymaster: PaymasterData;
  };
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp: string;
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

export class CartridgePoller {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly cartridgeApiUrl = "https://api.cartridge.gg/query";
  private readonly discordWebhookUrl: string;
  private readonly pollIntervalMs: number;
  private lastBudget: string | null = null;

  constructor(discordWebhookUrl: string, pollIntervalMs: number = 300000) {
    // Default 5 minutes
    this.discordWebhookUrl = discordWebhookUrl;
    this.pollIntervalMs = pollIntervalMs;
  }

  async fetchPaymasterData(): Promise<PaymasterData> {
    const query = {
      query: `{
  paymaster (name: "empire") {
    budget
    budgetFeeUnit
    creditFees
  }
}`,
    };

    try {
      const response = await fetch(this.cartridgeApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json, multipart/mixed",
          Referer: "https://api.cartridge.gg/playground",
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        throw new Error(`Cartridge API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as PaymasterResponse;

      if (!data.data?.paymaster) {
        throw new Error("Invalid response structure from Cartridge API");
      }

      return data.data.paymaster;
    } catch (error) {
      console.error("Failed to fetch paymaster data:", error);
      throw error;
    }
  }

  formatBudgetValue(budget: string, feeUnit: string): string {
    try {
      const budgetNum = BigInt(budget);
      // Convert from wei to ETH (divide by 10^18)
      const divisor = BigInt(10 ** 18);
      const ethValue = Number(budgetNum) / Number(divisor);
      return `${ethValue.toFixed(6)} ${feeUnit}`;
    } catch {
      return `${budget} ${feeUnit}`;
    }
  }

  createDiscordEmbed(paymasterData: PaymasterData): DiscordEmbed {
    const budgetChanged = this.lastBudget !== null && this.lastBudget !== paymasterData.budget;
    const formattedBudget = this.formatBudgetValue(paymasterData.budget, paymasterData.budgetFeeUnit);

    return {
      title: "🎮 Empire Paymaster Status",
      description: budgetChanged ? "⚠️ Budget has changed since last check" : "Current paymaster status",
      color: budgetChanged ? 0xff9500 : 0x00ff00, // Orange if changed, green otherwise
      fields: [
        {
          name: "💰 Budget",
          value: `\`${formattedBudget}\``,
          inline: true,
        },
        {
          name: "🪙 Fee Unit",
          value: `\`${paymasterData.budgetFeeUnit}\``,
          inline: true,
        },
        {
          name: "💳 Credit Fees",
          value: `\`${paymasterData.creditFees}\``,
          inline: true,
        },
        {
          name: "📊 Raw Budget",
          value: `\`${paymasterData.budget}\``,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  async postToDiscord(paymasterData: PaymasterData): Promise<void> {
    const embed = this.createDiscordEmbed(paymasterData);
    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    };

    try {
      const response = await fetch(this.discordWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
      }

      console.log("✓ Posted paymaster update to Discord");
      this.lastBudget = paymasterData.budget;
    } catch (error) {
      console.error("Failed to post to Discord:", error);
      throw error;
    }
  }

  async poll(): Promise<void> {
    try {
      console.log("Polling Cartridge paymaster...");
      const paymasterData = await this.fetchPaymasterData();
      await this.postToDiscord(paymasterData);
    } catch (error) {
      console.error("Polling error:", error);
      // Continue polling even if one request fails
    }
  }

  start(): void {
    if (this.pollingInterval) {
      console.warn("Cartridge poller is already running");
      return;
    }

    console.log(`Starting Cartridge poller (interval: ${this.pollIntervalMs / 1000}s)`);

    // Run immediately on start
    this.poll();

    // Then set up interval
    this.pollingInterval = setInterval(() => {
      this.poll();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("Cartridge poller stopped");
    }
  }
}

// Factory function to create and start the poller
export function createCartridgePoller(discordWebhookUrl: string, pollIntervalMs?: number): CartridgePoller {
  const poller = new CartridgePoller(discordWebhookUrl, pollIntervalMs);
  return poller;
}
