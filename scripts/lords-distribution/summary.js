import "dotenv/config";
import { RpcProvider } from "starknet";
import * as fs from "fs";
import { parse } from "csv-parse/sync";

// Configuration
const RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet";
const LORDS_DECIMALS = 18;
const STRK_DECIMALS = 18;

// Estimated gas per transfer (in gas units) - conservative estimate
const GAS_PER_TRANSFER = 5000n;
// Estimated data gas per transfer
const DATA_GAS_PER_TRANSFER = 500n;

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function loadCSV(filePath) {
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record) => ({
    address: record.address,
    registeredFor: record.registered_for,
    numGames: parseInt(record.num_games),
    reimbursementLords: parseFloat(record.reimbursement_lords),
  }));
}

async function main() {
  // Check for CSV file argument
  const csvPath = process.argv[2] || "reimbursements.csv";

  if (!fs.existsSync(csvPath)) {
    log(`Error: CSV file not found: ${csvPath}`, colors.yellow);
    log("\nUsage: node summary.js <path-to-csv>", colors.cyan);
    process.exit(1);
  }

  // Load CSV data
  log(`\n${colors.bold}📄 Loading CSV file: ${csvPath}${colors.reset}\n`);
  const recipients = loadCSV(csvPath);

  // Calculate totals
  const totalLords = recipients.reduce((sum, r) => sum + r.reimbursementLords, 0);
  const totalRecipients = recipients.length;

  // Group by amount
  const amountGroups = {};
  recipients.forEach((r) => {
    const amount = r.reimbursementLords;
    if (!amountGroups[amount]) {
      amountGroups[amount] = 0;
    }
    amountGroups[amount]++;
  });

  // Get current gas prices from network
  log(`${colors.blue}🔗 Fetching current gas prices from Starknet mainnet...${colors.reset}\n`);
  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  let gasPrice, dataGasPrice;
  try {
    const block = await provider.getBlock("latest");
    // Gas prices are in FRI (STRK's smallest unit)
    gasPrice = BigInt(block.l1_gas_price?.price_in_fri || "0");
    dataGasPrice = BigInt(block.l1_data_gas_price?.price_in_fri || "0");
  } catch (error) {
    log(`Warning: Could not fetch gas prices, using estimates`, colors.yellow);
    // Fallback estimates (in FRI)
    gasPrice = BigInt("100000000000"); // 100 gwei equivalent
    dataGasPrice = BigInt("10000000000"); // 10 gwei equivalent
  }

  // Estimate total gas needed
  const totalGasUnits = GAS_PER_TRANSFER * BigInt(totalRecipients);
  const totalDataGasUnits = DATA_GAS_PER_TRANSFER * BigInt(totalRecipients);

  // Calculate estimated fee in STRK (FRI)
  const estimatedGasCost = totalGasUnits * gasPrice;
  const estimatedDataGasCost = totalDataGasUnits * dataGasPrice;
  const totalEstimatedFee = estimatedGasCost + estimatedDataGasCost;

  // Add 50% buffer for safety
  const safeEstimate = (totalEstimatedFee * 150n) / 100n;

  // Convert to STRK (from FRI)
  const safeEstimateStrk = Number(safeEstimate) / 10 ** STRK_DECIMALS;

  // Print summary
  log("═".repeat(60), colors.blue);
  log(`${colors.bold}                    DISTRIBUTION SUMMARY${colors.reset}`);
  log("═".repeat(60), colors.blue);

  log(`\n${colors.cyan}📊 Recipients:${colors.reset}`);
  log(`   Total addresses: ${colors.bold}${totalRecipients}${colors.reset}`);

  log(`\n${colors.cyan}💰 LORDS Distribution:${colors.reset}`);
  log(`   Total LORDS: ${colors.bold}${totalLords.toLocaleString()}${colors.reset} LORDS`);

  log(`\n${colors.cyan}📈 Breakdown by amount:${colors.reset}`);
  Object.entries(amountGroups)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .forEach(([amount, count]) => {
      log(`   ${amount} LORDS: ${count} recipient${count > 1 ? "s" : ""}`);
    });

  log(`\n${colors.cyan}⛽ Gas Estimation (STRK):${colors.reset}`);
  log(`   Current L1 gas price: ${(Number(gasPrice) / 1e9).toFixed(2)} gwei`);
  log(`   Current L1 data gas price: ${(Number(dataGasPrice) / 1e9).toFixed(2)} gwei`);
  log(`   Estimated gas units: ${totalGasUnits.toLocaleString()}`);
  log(`   Estimated data gas units: ${totalDataGasUnits.toLocaleString()}`);
  log(
    `\n   ${colors.bold}Estimated fee: ${(Number(totalEstimatedFee) / 10 ** STRK_DECIMALS).toFixed(6)} STRK${colors.reset}`,
  );
  log(
    `   ${colors.bold}${colors.green}Recommended (with 50% buffer): ${safeEstimateStrk.toFixed(6)} STRK${colors.reset}`,
  );

  log("\n" + "═".repeat(60), colors.blue);
  log(`\n${colors.magenta}💡 Make sure your account has:${colors.reset}`);
  log(`   • ${colors.bold}${totalLords.toLocaleString()} LORDS${colors.reset} for distribution`);
  log(`   • ${colors.bold}~${safeEstimateStrk.toFixed(4)} STRK${colors.reset} for gas fees\n`);
}

main().catch(console.error);
